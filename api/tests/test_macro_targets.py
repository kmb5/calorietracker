"""Tests for GET /users/me/targets and PUT /users/me/targets."""

import pytest
from httpx import AsyncClient

from conftest import auth_headers, register_and_login


@pytest.mark.asyncio
async def test_get_targets_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/users/me/targets")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_put_targets_unauthenticated(client: AsyncClient) -> None:
    resp = await client.put("/users/me/targets", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_targets_default_nulls(client: AsyncClient) -> None:
    """A user who has never set targets gets all nulls."""
    token = await register_and_login(client, username="alice")
    resp = await client.get("/users/me/targets", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["kcal_target"] is None
    assert data["protein_g_target"] is None
    assert data["fat_g_target"] is None
    assert data["carbohydrates_g_target"] is None
    assert data["fiber_g_target"] is None
    assert data["sodium_mg_target"] is None


@pytest.mark.asyncio
async def test_put_targets_creates_row(client: AsyncClient) -> None:
    """PUT creates the row when one does not exist."""
    token = await register_and_login(client, username="alice")
    payload = {
        "kcal_target": 2000.0,
        "protein_g_target": 150.0,
        "fat_g_target": 70.0,
        "carbohydrates_g_target": 200.0,
        "fiber_g_target": 30.0,
        "sodium_mg_target": 2300.0,
    }
    resp = await client.put(
        "/users/me/targets", json=payload, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["kcal_target"] == 2000.0
    assert data["protein_g_target"] == 150.0
    assert data["fat_g_target"] == 70.0
    assert data["carbohydrates_g_target"] == 200.0
    assert data["fiber_g_target"] == 30.0
    assert data["sodium_mg_target"] == 2300.0


@pytest.mark.asyncio
async def test_put_targets_updates_row(client: AsyncClient) -> None:
    """PUT updates an existing row."""
    token = await register_and_login(client, username="alice")
    headers = auth_headers(token)
    # First PUT
    await client.put(
        "/users/me/targets",
        json={"kcal_target": 2000.0},
        headers=headers,
    )
    # Second PUT with different value
    resp = await client.put(
        "/users/me/targets",
        json={"kcal_target": 1800.0, "protein_g_target": 120.0},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["kcal_target"] == 1800.0
    assert data["protein_g_target"] == 120.0

    # Verify via GET
    get_resp = await client.get("/users/me/targets", headers=headers)
    assert get_resp.json()["kcal_target"] == 1800.0


@pytest.mark.asyncio
async def test_put_targets_omitted_fields_become_null(client: AsyncClient) -> None:
    """Omitting a field in PUT sets it to null (full replacement semantics)."""
    token = await register_and_login(client, username="alice")
    headers = auth_headers(token)
    # Set all fields
    await client.put(
        "/users/me/targets",
        json={"kcal_target": 2000.0, "protein_g_target": 150.0},
        headers=headers,
    )
    # PUT with only kcal — protein should become null
    resp = await client.put(
        "/users/me/targets",
        json={"kcal_target": 2000.0},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["protein_g_target"] is None


@pytest.mark.asyncio
async def test_put_targets_idempotent(client: AsyncClient) -> None:
    """Calling PUT twice with same values produces one row, not two."""
    token = await register_and_login(client, username="alice")
    headers = auth_headers(token)
    payload = {"kcal_target": 2000.0}
    await client.put("/users/me/targets", json=payload, headers=headers)
    resp = await client.put("/users/me/targets", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["kcal_target"] == 2000.0


@pytest.mark.asyncio
async def test_get_targets_isolation(client: AsyncClient) -> None:
    """User A never sees user B's targets."""
    token_a = await register_and_login(client, username="alice")
    token_b = await register_and_login(client, username="bob")

    # Bob sets targets
    await client.put(
        "/users/me/targets",
        json={"kcal_target": 3000.0},
        headers=auth_headers(token_b),
    )

    # Alice should still see nulls
    resp = await client.get("/users/me/targets", headers=auth_headers(token_a))
    assert resp.status_code == 200
    assert resp.json()["kcal_target"] is None


@pytest.mark.asyncio
async def test_put_targets_partial_fields(client: AsyncClient) -> None:
    """PUT with only some fields sets the rest to null."""
    token = await register_and_login(client, username="alice")
    headers = auth_headers(token)
    resp = await client.put(
        "/users/me/targets",
        json={"kcal_target": 1500.0, "fiber_g_target": 25.0},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["kcal_target"] == 1500.0
    assert data["fiber_g_target"] == 25.0
    assert data["protein_g_target"] is None
    assert data["fat_g_target"] is None
    assert data["carbohydrates_g_target"] is None
    assert data["sodium_mg_target"] is None
