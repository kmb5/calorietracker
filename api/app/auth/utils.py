"""Auth utilities: password hashing and JWT handling."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Password hashing  (bcrypt cost ≥ 12 in production; configurable for tests)
# ---------------------------------------------------------------------------


def _prepare(plain: str) -> bytes:
    """SHA-256 prehash to stay within bcrypt's 72-byte limit."""
    return hashlib.sha256(plain.encode()).hexdigest().encode()


def hash_password(plain: str, rounds: int = 12) -> str:
    return bcrypt.hashpw(_prepare(plain), bcrypt.gensalt(rounds=rounds)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prepare(plain), hashed.encode())


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


def create_access_token(user_id: int, role: str, secret_key: str) -> str:
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str, secret_key: str) -> dict:
    """Raises JWTError if the token is invalid or expired."""
    return jwt.decode(token, secret_key, algorithms=[ALGORITHM])


# ---------------------------------------------------------------------------
# Refresh token helpers
# ---------------------------------------------------------------------------


def generate_refresh_token() -> str:
    """Return a cryptographically random URL-safe token (plaintext)."""
    return secrets.token_urlsafe(64)


def refresh_token_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


# Re-export for convenience
JWTError = JWTError  # noqa: F811
