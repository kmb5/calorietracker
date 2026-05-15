"""Auth router: register, login, refresh, logout."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    refresh_token_expiry,
    verify_password,
)
from app.config import Settings, get_settings
from app.database import get_db
from app.limiter import limiter
from app.models import RefreshToken, User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# Dummy hash used in login to prevent username enumeration via timing.
# Computed lazily per-request using the live BCRYPT_ROUNDS so the cost always
# matches real password checks, even if BCRYPT_ROUNDS is raised in production.
def _get_dummy_hash(bcrypt_rounds: int) -> str:
    return hash_password("dummy-timing-protection", bcrypt_rounds)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_user_by_username(session: AsyncSession, username: str) -> User | None:
    result = await session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def _get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def _issue_tokens(
    session: AsyncSession, user: User, secret_key: str, bcrypt_rounds: int
) -> TokenResponse:
    """Create and persist a new refresh token; return both tokens."""
    access_token = create_access_token(user.id, user.role.value, secret_key)

    raw_refresh = generate_refresh_token()
    token_hash = hash_password(raw_refresh, bcrypt_rounds)  # bcrypt hash stored in DB

    db_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        token_prefix=raw_refresh[:16],
        expires_at=refresh_token_expiry(),
    )
    session.add(db_token)
    await session.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
async def register(
    request: Request,  # required by slowapi
    body: RegisterRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    if await _get_user_by_username(session, body.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    if await _get_user_by_email(session, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password, settings.BCRYPT_ROUNDS),
    )
    session.add(user)
    await session.flush()  # assigns user.id without committing yet
    return await _issue_tokens(
        session, user, settings.SECRET_KEY, settings.BCRYPT_ROUNDS
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,  # required by slowapi
    body: LoginRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = await _get_user_by_username(session, body.username)

    # Always run bcrypt even when the user doesn't exist — skipping it leaks
    # timing information that allows username enumeration.
    check_hash = (
        user.hashed_password if user else _get_dummy_hash(settings.BCRYPT_ROUNDS)
    )
    password_ok = verify_password(body.password, check_hash)

    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return await _issue_tokens(
        session, user, settings.SECRET_KEY, settings.BCRYPT_ROUNDS
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    invalid_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )

    # Look up the single candidate by prefix (indexed), then bcrypt-verify
    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.token_prefix == body.refresh_token[:16],
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(UTC),
        )
    )
    candidates = result.scalars().all()

    matched: RefreshToken | None = None
    for candidate in candidates:
        if verify_password(body.refresh_token, candidate.token_hash):
            matched = candidate
            break

    if not matched:
        raise invalid_exc

    user_result = await session.execute(select(User).where(User.id == matched.user_id))
    user = user_result.scalar_one_or_none()

    if not user or not user.is_active:
        raise invalid_exc

    # Revoke old token and issue new pair
    matched.revoked_at = datetime.now(UTC)
    await session.commit()

    return await _issue_tokens(
        session, user, settings.SECRET_KEY, settings.BCRYPT_ROUNDS
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: LogoutRequest,
    session: AsyncSession = Depends(get_db),
) -> None:
    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.token_prefix == body.refresh_token[:16],
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(UTC),
        )
    )
    candidates = result.scalars().all()

    for candidate in candidates:
        if verify_password(body.refresh_token, candidate.token_hash):
            candidate.revoked_at = datetime.now(UTC)
            await session.commit()
            return

    # Token not found or already revoked — treat as success (idempotent)
