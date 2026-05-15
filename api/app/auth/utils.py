"""Auth utilities: password hashing and JWT handling."""

import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# ---------------------------------------------------------------------------
# Password hashing  (bcrypt cost ≥ 12)
# ---------------------------------------------------------------------------

_BCRYPT_ROUNDS = 12


def _prepare(plain: str) -> bytes:
    """SHA-256 prehash to stay within bcrypt's 72-byte limit."""
    import hashlib

    return hashlib.sha256(plain.encode()).hexdigest().encode()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(
        _prepare(plain), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    ).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prepare(plain), hashed.encode())


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises JWTError if the token is invalid or expired."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])


# ---------------------------------------------------------------------------
# Refresh token helpers
# ---------------------------------------------------------------------------


def generate_refresh_token() -> str:
    """Return a cryptographically random URL-safe token (plaintext)."""
    return secrets.token_urlsafe(64)


def refresh_token_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


# Re-export for convenience
JWTError = JWTError  # noqa: F811  — re-export so callers import from here
