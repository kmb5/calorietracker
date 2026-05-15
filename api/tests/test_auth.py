"""Tests for /auth/* endpoints."""

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register(
    client: AsyncClient, username: str = "alice", password: str = "s3cr3t!1"
):
    return await client.post(
        "/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": password,
        },
    )


async def login(
    client: AsyncClient, username: str = "alice", password: str = "s3cr3t!1"
):
    return await client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await register(client, "reg_alice")
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    # refresh_token must NOT be in the response body — it lives in the cookie
    assert "refresh_token" not in data
    assert data["token_type"] == "bearer"
    assert "refresh_token" in resp.cookies


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    await register(client, "dup_user")
    resp = await register(client, "dup_user")
    assert resp.status_code == 400
    assert "Username" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    resp1 = await client.post(
        "/auth/register",
        json={
            "username": "user_a",
            "email": "shared@example.com",
            "password": "passw0rd1",
        },
    )
    assert resp1.status_code == 201
    resp2 = await client.post(
        "/auth/register",
        json={
            "username": "user_b",
            "email": "shared@example.com",
            "password": "passw0rd2",
        },
    )
    assert resp2.status_code == 400
    assert "Email" in resp2.json()["detail"]


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await register(client, "login_bob", "hunter2!")
    resp = await login(client, "login_bob", "hunter2!")
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    # refresh_token must NOT be in the response body
    assert "refresh_token" not in data
    assert "refresh_token" in resp.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await register(client, "wrong_pw_user", "correcthorse")
    resp = await login(client, "wrong_pw_user", "wrongpassword")
    assert resp.status_code == 401
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
    await register(client, "samemsg_user", "pass1234")
    wrong_pw = await login(client, "samemsg_user", "wrongpass")
    wrong_user = await login(client, "no_such_user", "pass1234")
    assert wrong_pw.json()["detail"] == wrong_user.json()["detail"]


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_success(client: AsyncClient):
    """After login the refresh cookie is sent automatically on the next call."""
    await register(client, "refresh_user", "mypassword")
    await login(client, "refresh_user", "mypassword")

    # httpx AsyncClient stores Set-Cookie headers and sends them back
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" not in data
    # A fresh cookie must be issued (token rotation)
    assert "refresh_token" in resp.cookies


@pytest.mark.asyncio
async def test_refresh_no_cookie(client: AsyncClient):
    """Request with no cookie at all must be rejected."""
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    """Request with a bad cookie value must be rejected."""
    resp = await client.post(
        "/auth/refresh", headers={"Cookie": "refresh_token=notavalidtoken"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_revoked_token(client: AsyncClient):
    """A token that has already been used (rotated) must be rejected."""
    await register(client, "revoke_refresh_user", "abc12345")
    login_resp = await login(client, "revoke_refresh_user", "abc12345")
    old_refresh = login_resp.cookies["refresh_token"]

    # Use the refresh token once — it gets revoked and replaced
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 200

    # Replay the old (now-revoked) token
    resp2 = await client.post(
        "/auth/refresh", headers={"Cookie": f"refresh_token={old_refresh}"}
    )
    assert resp2.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_logout_success(client: AsyncClient):
    await register(client, "logout_user", "passw0rd")
    await login(client, "logout_user", "passw0rd")

    resp = await client.post("/auth/logout")
    assert resp.status_code == 204
    # Cookie must be cleared in the response
    assert resp.cookies.get("refresh_token", "") == ""


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token(client: AsyncClient):
    await register(client, "logout_revoke_user", "passw0rd")
    login_resp = await login(client, "logout_revoke_user", "passw0rd")
    old_refresh = login_resp.cookies["refresh_token"]

    await client.post("/auth/logout")

    # The revoked token must no longer work
    resp = await client.post(
        "/auth/refresh", headers={"Cookie": f"refresh_token={old_refresh}"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_idempotent(client: AsyncClient):
    """Logging out with an already-revoked token should still return 204."""
    await register(client, "idempotent_user", "passw0rd")
    login_resp = await login(client, "idempotent_user", "passw0rd")
    old_refresh = login_resp.cookies["refresh_token"]

    await client.post("/auth/logout")
    resp2 = await client.post(
        "/auth/logout", headers={"Cookie": f"refresh_token={old_refresh}"}
    )
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

    payload = jwt.decode(
        token, "test-secret-key-not-for-production", algorithms=["HS256"]
    )
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

    result = await db_session.execute(
        select(User).where(User.username == "inactive_user")
    )
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
    await register(client, "ratelimit_user", "passw0rd")
    for _ in range(5):
        await login(client, "ratelimit_user", "wrongpass")
    resp = await login(client, "ratelimit_user", "wrongpass")
    assert resp.status_code == 429
