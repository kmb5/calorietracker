"""Tests for /auth/* endpoints."""
import pytest
from httpx import AsyncClient

from tests.conftest import _TEST_SETTINGS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register(client: AsyncClient, username: str = "alice", password: str = "s3cr3t!") -> dict:
    resp = await client.post(
        "/auth/register",
        json={"username": username, "email": f"{username}@example.com", "password": password},
    )
    return resp


async def login(client: AsyncClient, username: str = "alice", password: str = "s3cr3t!") -> dict:
    resp = await client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    return resp


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await register(client, "reg_alice")
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    await register(client, "dup_user")
    resp = await register(client, "dup_user")
    assert resp.status_code == 400
    assert "Username" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    # Two users with the same email but different usernames
    resp1 = await client.post(
        "/auth/register",
        json={"username": "user_a", "email": "shared@example.com", "password": "pass1"},
    )
    assert resp1.status_code == 201
    resp2 = await client.post(
        "/auth/register",
        json={"username": "user_b", "email": "shared@example.com", "password": "pass2"},
    )
    assert resp2.status_code == 400
    assert "Email" in resp2.json()["detail"]


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await register(client, "login_bob", "hunter2")
    resp = await login(client, "login_bob", "hunter2")
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await register(client, "wrong_pw_user", "correcthorse")
    resp = await login(client, "wrong_pw_user", "wrongpassword")
    assert resp.status_code == 401
    # Generic message — must not reveal which field was wrong
    detail = resp.json()["detail"].lower()
    assert "invalid credentials" in detail or "invalid" in detail
    assert "password" not in detail
    assert "username" not in detail


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await login(client, "ghost", "doesntmatter")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_error_message_generic(client: AsyncClient):
    """Error message on wrong username must be identical to wrong password."""
    await register(client, "samemsg_user", "pass123")
    wrong_pw = await login(client, "samemsg_user", "wrongpass")
    wrong_user = await login(client, "no_such_user", "pass123")
    assert wrong_pw.json()["detail"] == wrong_user.json()["detail"]


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_success(client: AsyncClient):
    await register(client, "refresh_user", "mypassword")
    login_resp = await login(client, "refresh_user", "mypassword")
    refresh_token = login_resp.json()["refresh_token"]

    resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post("/auth/refresh", json={"refresh_token": "notavalidtoken"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_revoked_token(client: AsyncClient):
    await register(client, "revoke_refresh_user", "abc123")
    login_resp = await login(client, "revoke_refresh_user", "abc123")
    old_refresh = login_resp.json()["refresh_token"]

    # Use the refresh token once — it gets revoked after use
    resp = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 200

    # Second use of the same token must fail
    resp2 = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert resp2.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_logout_success(client: AsyncClient):
    await register(client, "logout_user", "passw0rd")
    login_resp = await login(client, "logout_user", "passw0rd")
    refresh_token = login_resp.json()["refresh_token"]

    resp = await client.post("/auth/logout", json={"refresh_token": refresh_token})
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token(client: AsyncClient):
    await register(client, "logout_revoke_user", "passw0rd")
    login_resp = await login(client, "logout_revoke_user", "passw0rd")
    refresh_token = login_resp.json()["refresh_token"]

    await client.post("/auth/logout", json={"refresh_token": refresh_token})

    # Token must now be unusable
    resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_idempotent(client: AsyncClient):
    """Logging out with an already-revoked token should still return 204."""
    await register(client, "idempotent_user", "pass")
    login_resp = await login(client, "idempotent_user", "pass")
    refresh_token = login_resp.json()["refresh_token"]

    await client.post("/auth/logout", json={"refresh_token": refresh_token})
    resp2 = await client.post("/auth/logout", json={"refresh_token": refresh_token})
    assert resp2.status_code == 204


# ---------------------------------------------------------------------------
# Access token contents
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_access_token_encodes_user_id_and_role(client: AsyncClient):
    from jose import jwt

    await register(client, "jwt_user", "secret99")
    login_resp = await login(client, "jwt_user", "secret99")
    token = login_resp.json()["access_token"]

    payload = jwt.decode(token, _TEST_SETTINGS.SECRET_KEY, algorithms=["HS256"])
    assert "sub" in payload
    assert "role" in payload
    assert payload["role"] == "user"


# ---------------------------------------------------------------------------
# Deactivated user
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_deactivated_user_cannot_login(client: AsyncClient, db_session):
    from sqlalchemy import select
    from app.models import User

    await register(client, "inactive_user", "active123")

    # Deactivate the user directly in the DB
    result = await db_session.execute(select(User).where(User.username == "inactive_user"))
    user = result.scalar_one()
    user.is_active = False
    await db_session.commit()

    resp = await login(client, "inactive_user", "active123")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rate_limit_429_on_sixth_attempt(client: AsyncClient):
    """6th login attempt within 1 minute from the same IP returns HTTP 429."""
    await register(client, "ratelimit_user", "pass")
    for _ in range(5):
        await login(client, "ratelimit_user", "wrongpass")
    resp = await login(client, "ratelimit_user", "wrongpass")
    assert resp.status_code == 429
