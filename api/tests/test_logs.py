"""
Tests for issue 25: Log Entry Management Backend
Covers: PATCH /logs/{id}, DELETE /logs/{id},
        POST /logs/{id}/entries, PATCH /logs/{id}/entries/{entry_id},
        DELETE /logs/{id}/entries/{entry_id}

Also includes core GET/POST tests from issue 24 (02-02) since
they are a prerequisite for this issue's endpoints.
"""

import pytest
from httpx import AsyncClient

from conftest import auth_headers, register_and_login


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ENTRY = {
    "ingredient_id": None,
    "recipe_id": None,
    "amount_g": 100.0,
    "kcal": 200.0,
    "protein_g": 10.0,
    "fat_g": 5.0,
    "carbohydrates_g": 30.0,
    "fiber_g": 2.0,
    "sodium_mg": 50.0,
}

_LOG_PAYLOAD = {
    "logged_date": "2024-01-15",
    "meal_type": "breakfast",
    "name": "Test Meal",
    "notes": None,
    "entries": [_ENTRY],
}


async def _create_log(client: AsyncClient, token: str, payload: dict | None = None) -> dict:
    payload = payload or _LOG_PAYLOAD
    resp = await client.post("/logs", json=payload, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# 02-02 core: GET /logs and POST /logs
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_log_requires_auth(client: AsyncClient):
    resp = await client.post("/logs", json=_LOG_PAYLOAD)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_log_success(client: AsyncClient):
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)

    assert log["logged_date"] == "2024-01-15"
    assert log["meal_type"] == "breakfast"
    assert log["name"] == "Test Meal"
    assert len(log["entries"]) == 1
    entry = log["entries"][0]
    assert entry["kcal"] == 200.0
    assert entry["amount_g"] == 100.0


@pytest.mark.asyncio
async def test_list_logs_requires_auth(client: AsyncClient):
    resp = await client.get("/logs", params={"date": "2024-01-15"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_logs_for_date(client: AsyncClient):
    token = await register_and_login(client, "alice")
    await _create_log(client, token)

    resp = await client.get(
        "/logs", params={"date": "2024-01-15"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["logged_date"] == "2024-01-15"


@pytest.mark.asyncio
async def test_list_logs_empty_date_returns_empty_list(client: AsyncClient):
    token = await register_and_login(client, "alice")
    resp = await client.get(
        "/logs", params={"date": "2099-12-31"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_logs_user_isolation(client: AsyncClient):
    """User A cannot see User B's logs."""
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    await _create_log(client, token_a)

    resp = await client.get(
        "/logs", params={"date": "2024-01-15"}, headers=auth_headers(token_b)
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_daily_summary_empty(client: AsyncClient):
    token = await register_and_login(client, "alice")
    resp = await client.get(
        "/logs/summary", params={"date": "2099-01-01"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["kcal"] == 0.0
    assert data["protein_g"] == 0.0


@pytest.mark.asyncio
async def test_daily_summary_with_entries(client: AsyncClient):
    token = await register_and_login(client, "alice")
    # Create two logs with one entry each
    await _create_log(client, token)
    payload2 = dict(_LOG_PAYLOAD)
    payload2["meal_type"] = "lunch"
    payload2["entries"] = [{**_ENTRY, "kcal": 300.0, "protein_g": 20.0}]
    await _create_log(client, token, payload2)

    resp = await client.get(
        "/logs/summary", params={"date": "2024-01-15"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["kcal"] == 500.0
    assert data["protein_g"] == 30.0


# ---------------------------------------------------------------------------
# PATCH /logs/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_log_requires_auth(client: AsyncClient):
    resp = await client.patch("/logs/1", json={"meal_type": "lunch"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_patch_log_success(client: AsyncClient):
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)
    log_id = log["id"]

    resp = await client.patch(
        f"/logs/{log_id}",
        json={"meal_type": "dinner", "notes": "Updated notes"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["meal_type"] == "dinner"
    assert data["notes"] == "Updated notes"


@pytest.mark.asyncio
async def test_patch_log_other_user_returns_404(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    log = await _create_log(client, token_a)

    resp = await client.patch(
        f"/logs/{log['id']}",
        json={"meal_type": "lunch"},
        headers=auth_headers(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_log_not_found(client: AsyncClient):
    token = await register_and_login(client, "alice")
    resp = await client.patch(
        "/logs/99999", json={"meal_type": "lunch"}, headers=auth_headers(token)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /logs/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_log_requires_auth(client: AsyncClient):
    resp = await client.delete("/logs/1")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_log_success(client: AsyncClient):
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)
    log_id = log["id"]

    resp = await client.delete(f"/logs/{log_id}", headers=auth_headers(token))
    assert resp.status_code == 204

    # Confirm it's gone
    resp = await client.get(
        "/logs", params={"date": "2024-01-15"}, headers=auth_headers(token)
    )
    assert resp.json() == []


@pytest.mark.asyncio
async def test_delete_log_removes_entries(client: AsyncClient):
    """Cascade: deleting a log removes its entries."""
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)
    log_id = log["id"]
    entry_id = log["entries"][0]["id"]

    await client.delete(f"/logs/{log_id}", headers=auth_headers(token))

    # The entry should also be gone (can't access it via the log)
    resp = await client.patch(
        f"/logs/{log_id}/entries/{entry_id}",
        json={"amount_g": 50.0},
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_log_other_user_returns_404(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    log = await _create_log(client, token_a)

    resp = await client.delete(
        f"/logs/{log['id']}", headers=auth_headers(token_b)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /logs/{id}/entries
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_entry_requires_auth(client: AsyncClient):
    resp = await client.post("/logs/1/entries", json=_ENTRY)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_add_entry_success(client: AsyncClient):
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)
    log_id = log["id"]

    new_entry = {**_ENTRY, "kcal": 150.0, "amount_g": 75.0}
    resp = await client.post(
        f"/logs/{log_id}/entries", json=new_entry, headers=auth_headers(token)
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["kcal"] == 150.0
    assert data["meal_log_id"] == log_id


@pytest.mark.asyncio
async def test_add_entry_other_user_returns_404(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    log = await _create_log(client, token_a)

    resp = await client.post(
        f"/logs/{log['id']}/entries", json=_ENTRY, headers=auth_headers(token_b)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_entry_log_not_found(client: AsyncClient):
    token = await register_and_login(client, "alice")
    resp = await client.post(
        "/logs/99999/entries", json=_ENTRY, headers=auth_headers(token)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /logs/{id}/entries/{entry_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_entry_requires_auth(client: AsyncClient):
    resp = await client.patch("/logs/1/entries/1", json={"amount_g": 50.0})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_patch_entry_recalculates_nutrition(client: AsyncClient):
    """PATCH amount_g=50 on a 100g entry halves all nutrition values."""
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)
    log_id = log["id"]
    entry_id = log["entries"][0]["id"]

    resp = await client.patch(
        f"/logs/{log_id}/entries/{entry_id}",
        json={"amount_g": 50.0},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount_g"] == 50.0
    assert data["kcal"] == pytest.approx(100.0)  # 200 * (50/100)
    assert data["protein_g"] == pytest.approx(5.0)  # 10 * 0.5
    assert data["fat_g"] == pytest.approx(2.5)
    assert data["carbohydrates_g"] == pytest.approx(15.0)
    assert data["fiber_g"] == pytest.approx(1.0)
    assert data["sodium_mg"] == pytest.approx(25.0)


@pytest.mark.asyncio
async def test_patch_entry_other_user_returns_404(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    log = await _create_log(client, token_a)
    entry_id = log["entries"][0]["id"]

    resp = await client.patch(
        f"/logs/{log['id']}/entries/{entry_id}",
        json={"amount_g": 50.0},
        headers=auth_headers(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_entry_not_found(client: AsyncClient):
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)

    resp = await client.patch(
        f"/logs/{log['id']}/entries/99999",
        json={"amount_g": 50.0},
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /logs/{id}/entries/{entry_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_entry_requires_auth(client: AsyncClient):
    resp = await client.delete("/logs/1/entries/1")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_entry_success(client: AsyncClient):
    token = await register_and_login(client, "alice")
    # Create log with two entries
    payload = dict(_LOG_PAYLOAD)
    payload["entries"] = [_ENTRY, {**_ENTRY, "kcal": 50.0}]
    log = await _create_log(client, token, payload)
    log_id = log["id"]
    entry_id = log["entries"][0]["id"]

    resp = await client.delete(
        f"/logs/{log_id}/entries/{entry_id}", headers=auth_headers(token)
    )
    assert resp.status_code == 204

    # Parent log still exists, with one entry remaining
    resp = await client.get(
        "/logs", params={"date": "2024-01-15"}, headers=auth_headers(token)
    )
    data = resp.json()
    assert len(data) == 1
    assert len(data[0]["entries"]) == 1


@pytest.mark.asyncio
async def test_delete_last_entry_parent_log_remains(client: AsyncClient):
    """After deleting the last entry, the parent MealLog still exists."""
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)
    log_id = log["id"]
    entry_id = log["entries"][0]["id"]

    await client.delete(
        f"/logs/{log_id}/entries/{entry_id}", headers=auth_headers(token)
    )

    resp = await client.get(
        "/logs", params={"date": "2024-01-15"}, headers=auth_headers(token)
    )
    data = resp.json()
    assert len(data) == 1  # log still there
    assert data[0]["entries"] == []  # but no entries


@pytest.mark.asyncio
async def test_delete_entry_other_user_returns_404(client: AsyncClient):
    token_a = await register_and_login(client, "alice")
    token_b = await register_and_login(client, "bob")
    log = await _create_log(client, token_a)
    entry_id = log["entries"][0]["id"]

    resp = await client.delete(
        f"/logs/{log['id']}/entries/{entry_id}",
        headers=auth_headers(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_entry_not_found(client: AsyncClient):
    token = await register_and_login(client, "alice")
    log = await _create_log(client, token)

    resp = await client.delete(
        f"/logs/{log['id']}/entries/99999", headers=auth_headers(token)
    )
    assert resp.status_code == 404
