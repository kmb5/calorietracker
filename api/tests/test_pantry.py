"""Tests for pantry endpoints — CRUD + storage location filter (issue #37)."""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from conftest import auth_headers, register_and_login


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE = "/pantry"


async def make_item(
    client: AsyncClient,
    token: str,
    *,
    name: str = "Milk",
    quantity: float = 1.0,
    unit: str = "L",
    storage_location: str = "fridge",
    expiry_date: str | None = None,
    notes: str | None = None,
) -> dict:
    payload: dict = {
        "name": name,
        "quantity": quantity,
        "unit": unit,
        "storage_location": storage_location,
    }
    if expiry_date is not None:
        payload["expiry_date"] = expiry_date
    if notes is not None:
        payload["notes"] = notes
    resp = await client.post(BASE, json=payload, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Auth guard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_pantry_requires_auth(client: AsyncClient) -> None:
    resp = await client.get(BASE)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# CRUD — basic create / list / update / delete
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_pantry_item(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    item = await make_item(client, token, name="Butter", storage_location="fridge")
    assert item["name"] == "Butter"
    assert item["storage_location"] == "fridge"
    assert item["quantity"] == 1.0


@pytest.mark.asyncio
async def test_list_pantry_items_empty(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    resp = await client.get(BASE, headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_pantry_items(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    await make_item(client, token, name="Milk", storage_location="fridge")
    await make_item(client, token, name="Peas", storage_location="freezer")

    resp = await client.get(BASE, headers=auth_headers(token))
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "Milk" in names
    assert "Peas" in names


@pytest.mark.asyncio
async def test_update_pantry_item(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    item = await make_item(client, token, name="Milk", quantity=2.0)
    item_id = item["id"]

    resp = await client.patch(
        f"{BASE}/{item_id}",
        json={"quantity": 1.0, "notes": "half used"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["quantity"] == 1.0
    assert data["notes"] == "half used"


@pytest.mark.asyncio
async def test_delete_pantry_item(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    item = await make_item(client, token, name="Milk")
    item_id = item["id"]

    resp = await client.delete(f"{BASE}/{item_id}", headers=auth_headers(token))
    assert resp.status_code == 204

    resp2 = await client.get(BASE, headers=auth_headers(token))
    assert resp2.json() == []


# ---------------------------------------------------------------------------
# Access control — users cannot see / modify each other's items
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_users_cannot_see_each_others_items(client: AsyncClient) -> None:
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")

    await make_item(client, token_a, name="Alice's milk")
    await make_item(client, token_b, name="Bob's juice")

    resp_a = await client.get(BASE, headers=auth_headers(token_a))
    names_a = [i["name"] for i in resp_a.json()]
    assert "Alice's milk" in names_a
    assert "Bob's juice" not in names_a


@pytest.mark.asyncio
async def test_cannot_update_other_users_item(client: AsyncClient) -> None:
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")

    item = await make_item(client, token_a, name="Alice's milk")
    resp = await client.patch(
        f"{BASE}/{item['id']}",
        json={"quantity": 99},
        headers=auth_headers(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_delete_other_users_item(client: AsyncClient) -> None:
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")

    item = await make_item(client, token_a, name="Alice's milk")
    resp = await client.delete(
        f"{BASE}/{item['id']}", headers=auth_headers(token_b)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Storage location filter — the main feature of issue #37
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_filter_by_fridge(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    await make_item(client, token, name="Milk", storage_location="fridge")
    await make_item(client, token, name="Ice cream", storage_location="freezer")
    await make_item(client, token, name="Pasta", storage_location="pantry")

    resp = await client.get(f"{BASE}?location=fridge", headers=auth_headers(token))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Milk"
    assert items[0]["storage_location"] == "fridge"


@pytest.mark.asyncio
async def test_filter_by_freezer(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    await make_item(client, token, name="Milk", storage_location="fridge")
    await make_item(client, token, name="Ice cream", storage_location="freezer")

    resp = await client.get(f"{BASE}?location=freezer", headers=auth_headers(token))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Ice cream"


@pytest.mark.asyncio
async def test_filter_by_pantry(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    await make_item(client, token, name="Pasta", storage_location="pantry")
    await make_item(client, token, name="Milk", storage_location="fridge")

    resp = await client.get(f"{BASE}?location=pantry", headers=auth_headers(token))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Pasta"


@pytest.mark.asyncio
async def test_filter_by_other(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    await make_item(client, token, name="Spices", storage_location="other")
    await make_item(client, token, name="Milk", storage_location="fridge")

    resp = await client.get(f"{BASE}?location=other", headers=auth_headers(token))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Spices"


@pytest.mark.asyncio
async def test_no_location_filter_returns_all(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    await make_item(client, token, name="Milk", storage_location="fridge")
    await make_item(client, token, name="Ice cream", storage_location="freezer")
    await make_item(client, token, name="Pasta", storage_location="pantry")
    await make_item(client, token, name="Spices", storage_location="other")

    resp = await client.get(BASE, headers=auth_headers(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 4


@pytest.mark.asyncio
async def test_invalid_location_returns_422(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    resp = await client.get(f"{BASE}?location=garage", headers=auth_headers(token))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_filter_applies_only_to_calling_user(client: AsyncClient) -> None:
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")

    await make_item(client, token_a, name="Alice's fridge item", storage_location="fridge")
    await make_item(client, token_b, name="Bob's fridge item", storage_location="fridge")

    resp = await client.get(f"{BASE}?location=fridge", headers=auth_headers(token_a))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Alice's fridge item"


# ---------------------------------------------------------------------------
# Sort order — expiry ASC, nulls last, then created_at DESC
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sort_order_expiry_asc_nulls_last(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    today = date.today()

    await make_item(
        client, token, name="Expires soon", expiry_date=str(today + timedelta(days=2))
    )
    await make_item(
        client, token, name="Expires later", expiry_date=str(today + timedelta(days=10))
    )
    await make_item(client, token, name="No expiry")

    resp = await client.get(BASE, headers=auth_headers(token))
    items = resp.json()
    names = [i["name"] for i in items]
    assert names.index("Expires soon") < names.index("Expires later")
    assert names.index("Expires later") < names.index("No expiry")


@pytest.mark.asyncio
async def test_filter_results_maintain_sort_order(client: AsyncClient) -> None:
    """Filter results must still be sorted: expiry ASC, nulls last."""
    token = await register_and_login(client, "alice")
    today = date.today()

    await make_item(
        client,
        token,
        name="Fridge later",
        storage_location="fridge",
        expiry_date=str(today + timedelta(days=10)),
    )
    await make_item(
        client,
        token,
        name="Fridge soon",
        storage_location="fridge",
        expiry_date=str(today + timedelta(days=1)),
    )
    await make_item(
        client,
        token,
        name="Fridge no expiry",
        storage_location="fridge",
    )

    resp = await client.get(f"{BASE}?location=fridge", headers=auth_headers(token))
    items = resp.json()
    names = [i["name"] for i in items]
    assert names == ["Fridge soon", "Fridge later", "Fridge no expiry"]


# ---------------------------------------------------------------------------
# /pantry/expiring — location filter on expiring endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_expiring_endpoint_basic(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    today = date.today()

    await make_item(
        client, token, name="Expires tomorrow", expiry_date=str(today + timedelta(days=1))
    )
    await make_item(
        client, token, name="Expires in 10 days", expiry_date=str(today + timedelta(days=10))
    )

    resp = await client.get(f"{BASE}/expiring?days=3", headers=auth_headers(token))
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "Expires tomorrow" in names
    assert "Expires in 10 days" not in names


@pytest.mark.asyncio
async def test_expiring_endpoint_with_location_filter(client: AsyncClient) -> None:
    token = await register_and_login(client, "alice")
    today = date.today()

    await make_item(
        client,
        token,
        name="Fridge expiring",
        storage_location="fridge",
        expiry_date=str(today + timedelta(days=1)),
    )
    await make_item(
        client,
        token,
        name="Freezer expiring",
        storage_location="freezer",
        expiry_date=str(today + timedelta(days=1)),
    )

    resp = await client.get(
        f"{BASE}/expiring?days=3&location=fridge", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Fridge expiring"
