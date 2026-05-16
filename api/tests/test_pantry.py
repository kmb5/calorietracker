"""Tests for /pantry/* endpoints."""

from datetime import date, timedelta

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_item(
    client: AsyncClient,
    token: str,
    *,
    name: str = "Milk",
    quantity: float = 1.0,
    unit: str = "litre",
    expiry_date: str | None = None,
    storage_location: str = "pantry",
    notes: str | None = None,
    ingredient_id: int | None = None,
) -> dict:
    body: dict = {
        "name": name,
        "quantity": quantity,
        "unit": unit,
        "storage_location": storage_location,
    }
    if expiry_date is not None:
        body["expiry_date"] = expiry_date
    if notes is not None:
        body["notes"] = notes
    if ingredient_id is not None:
        body["ingredient_id"] = ingredient_id
    resp = await client.post("/pantry", json=body, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Authentication guards
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_requires_auth(client: AsyncClient):
    resp = await client.get("/pantry")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/pantry", json={"name": "x", "quantity": 1, "unit": "g"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_patch_requires_auth(client: AsyncClient):
    resp = await client.patch("/pantry/999", json={"quantity": 2})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_requires_auth(client: AsyncClient):
    resp = await client.delete("/pantry/999")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_expiring_requires_auth(client: AsyncClient):
    resp = await client.get("/pantry/expiring")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /pantry
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_item(client: AsyncClient):
    token = await register_and_login(client, "alice")
    item = await _create_item(client, token, name="Eggs", quantity=12, unit="piece")
    assert item["name"] == "Eggs"
    assert item["quantity"] == 12
    assert item["unit"] == "piece"
    assert item["ingredient_id"] is None
    assert item["expiry_date"] is None
    assert item["storage_location"] == "pantry"


@pytest.mark.asyncio
async def test_create_item_with_expiry(client: AsyncClient):
    token = await register_and_login(client, "alice")
    expiry = (date.today() + timedelta(days=5)).isoformat()
    item = await _create_item(client, token, name="Milk", expiry_date=expiry)
    assert item["expiry_date"] == expiry


@pytest.mark.asyncio
async def test_create_item_ingredient_id_optional(client: AsyncClient):
    token = await register_and_login(client, "alice")
    # No ingredient_id — free-text only
    item = await _create_item(client, token, name="Mystery Spice", unit="tsp")
    assert item["ingredient_id"] is None


@pytest.mark.asyncio
async def test_create_item_default_storage_location(client: AsyncClient):
    token = await register_and_login(client, "alice")
    resp = await client.post(
        "/pantry",
        json={"name": "Butter", "quantity": 250, "unit": "g"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["storage_location"] == "pantry"


# ---------------------------------------------------------------------------
# GET /pantry — sort order
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_returns_own_items(client: AsyncClient):
    token = await register_and_login(client, "alice")
    await _create_item(client, token, name="Apple")
    await _create_item(client, token, name="Banana")
    resp = await client.get("/pantry", headers=auth_headers(token))
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "Apple" in names
    assert "Banana" in names


@pytest.mark.asyncio
async def test_list_sort_dated_before_undated(client: AsyncClient):
    token = await register_and_login(client, "alice")
    await _create_item(client, token, name="NoDate")
    expiry = (date.today() + timedelta(days=10)).isoformat()
    await _create_item(client, token, name="HasDate", expiry_date=expiry)
    resp = await client.get("/pantry", headers=auth_headers(token))
    items = resp.json()
    names = [i["name"] for i in items]
    # HasDate should come before NoDate
    assert names.index("HasDate") < names.index("NoDate")


@pytest.mark.asyncio
async def test_list_sort_dated_ascending(client: AsyncClient):
    token = await register_and_login(client, "alice")
    later = (date.today() + timedelta(days=20)).isoformat()
    sooner = (date.today() + timedelta(days=2)).isoformat()
    await _create_item(client, token, name="Later", expiry_date=later)
    await _create_item(client, token, name="Sooner", expiry_date=sooner)
    resp = await client.get("/pantry", headers=auth_headers(token))
    items = resp.json()
    names = [i["name"] for i in items if i["expiry_date"] is not None]
    assert names.index("Sooner") < names.index("Later")


@pytest.mark.asyncio
async def test_list_past_expiry_at_top(client: AsyncClient):
    """Items past their expiry date appear at the top (most negative days first)."""
    token = await register_and_login(client, "alice")
    past = (date.today() - timedelta(days=3)).isoformat()
    future = (date.today() + timedelta(days=5)).isoformat()
    await _create_item(client, token, name="Future", expiry_date=future)
    await _create_item(client, token, name="Expired", expiry_date=past)
    resp = await client.get("/pantry", headers=auth_headers(token))
    names = [i["name"] for i in resp.json() if i["expiry_date"] is not None]
    assert names.index("Expired") < names.index("Future")


# ---------------------------------------------------------------------------
# PATCH /pantry/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_quantity(client: AsyncClient):
    token = await register_and_login(client, "alice")
    item = await _create_item(client, token, name="Milk", quantity=1.0)
    resp = await client.patch(
        f"/pantry/{item['id']}",
        json={"quantity": 2.5},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["quantity"] == 2.5


@pytest.mark.asyncio
async def test_patch_expiry_date(client: AsyncClient):
    token = await register_and_login(client, "alice")
    item = await _create_item(client, token, name="Yogurt")
    new_expiry = (date.today() + timedelta(days=7)).isoformat()
    resp = await client.patch(
        f"/pantry/{item['id']}",
        json={"expiry_date": new_expiry},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["expiry_date"] == new_expiry


@pytest.mark.asyncio
async def test_patch_storage_location(client: AsyncClient):
    token = await register_and_login(client, "alice")
    item = await _create_item(client, token, name="IceCream")
    resp = await client.patch(
        f"/pantry/{item['id']}",
        json={"storage_location": "freezer"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["storage_location"] == "freezer"


@pytest.mark.asyncio
async def test_patch_notes(client: AsyncClient):
    token = await register_and_login(client, "alice")
    item = await _create_item(client, token, name="Cheese")
    resp = await client.patch(
        f"/pantry/{item['id']}",
        json={"notes": "buy more next week"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "buy more next week"


@pytest.mark.asyncio
async def test_patch_unit(client: AsyncClient):
    token = await register_and_login(client, "alice")
    item = await _create_item(client, token, name="Water", unit="ml")
    resp = await client.patch(
        f"/pantry/{item['id']}",
        json={"unit": "litre"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["unit"] == "litre"


# ---------------------------------------------------------------------------
# DELETE /pantry/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_item(client: AsyncClient):
    token = await register_and_login(client, "alice")
    item = await _create_item(client, token, name="Spinach")
    resp = await client.delete(
        f"/pantry/{item['id']}", headers=auth_headers(token)
    )
    assert resp.status_code == 204
    # Verify it's gone
    list_resp = await client.get("/pantry", headers=auth_headers(token))
    names = [i["name"] for i in list_resp.json()]
    assert "Spinach" not in names


# ---------------------------------------------------------------------------
# Access control — User A cannot access User B's items
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_user_cannot_see_other_users_items(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    await _create_item(client, token_a, name="AliceItem")
    resp = await client.get("/pantry", headers=auth_headers(token_b))
    names = [i["name"] for i in resp.json()]
    assert "AliceItem" not in names


@pytest.mark.asyncio
async def test_user_cannot_patch_other_users_item(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    item = await _create_item(client, token_a, name="AliceItem")
    resp = await client.patch(
        f"/pantry/{item['id']}",
        json={"quantity": 99},
        headers=auth_headers(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_user_cannot_delete_other_users_item(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    item = await _create_item(client, token_a, name="AliceItem")
    resp = await client.delete(
        f"/pantry/{item['id']}", headers=auth_headers(token_b)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /pantry/expiring
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_expiring_returns_items_within_days(client: AsyncClient):
    token = await register_and_login(client, "alice")
    expiry_soon = date.today().isoformat()  # today
    expiry_far = (date.today() + timedelta(days=10)).isoformat()
    await _create_item(client, token, name="ExpiresToday", expiry_date=expiry_soon)
    await _create_item(client, token, name="ExpiresLater", expiry_date=expiry_far)
    resp = await client.get(
        "/pantry/expiring?days=3", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "ExpiresToday" in names
    assert "ExpiresLater" not in names


@pytest.mark.asyncio
async def test_expiring_includes_already_expired(client: AsyncClient):
    token = await register_and_login(client, "alice")
    past = (date.today() - timedelta(days=2)).isoformat()
    await _create_item(client, token, name="AlreadyExpired", expiry_date=past)
    resp = await client.get(
        "/pantry/expiring?days=3", headers=auth_headers(token)
    )
    names = [i["name"] for i in resp.json()]
    assert "AlreadyExpired" in names


@pytest.mark.asyncio
async def test_expiring_excludes_no_expiry_items(client: AsyncClient):
    token = await register_and_login(client, "alice")
    await _create_item(client, token, name="NoExpiry")
    resp = await client.get(
        "/pantry/expiring?days=365", headers=auth_headers(token)
    )
    names = [i["name"] for i in resp.json()]
    assert "NoExpiry" not in names


@pytest.mark.asyncio
async def test_expiring_only_own_items(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    expiry = date.today().isoformat()
    await _create_item(client, token_a, name="AliceExpiring", expiry_date=expiry)
    resp = await client.get(
        "/pantry/expiring?days=1", headers=auth_headers(token_b)
    )
    names = [i["name"] for i in resp.json()]
    assert "AliceExpiring" not in names
