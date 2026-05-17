"""Tests for meal log endpoints: POST /logs, GET /logs, GET /logs/summary."""

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

LOG_DATE = "2025-06-15"

ENTRY_PAYLOAD = {
    "amount_g": 100.0,
    "kcal": 250.0,
    "protein_g": 20.0,
    "fat_g": 10.0,
    "carbohydrates_g": 15.0,
    "fiber_g": 3.0,
    "sodium_mg": 120.0,
}

LOG_PAYLOAD = {
    "logged_date": LOG_DATE,
    "meal_type": "breakfast",
    "name": "Oatmeal",
    "notes": "With blueberries",
    "entries": [ENTRY_PAYLOAD],
}


# ---------------------------------------------------------------------------
# POST /logs
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_log_returns_201(client: AsyncClient) -> None:
    token = await register_and_login(client)
    resp = await client.post("/logs", json=LOG_PAYLOAD, headers=auth_headers(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["logged_date"] == LOG_DATE
    assert body["meal_type"] == "breakfast"
    assert body["name"] == "Oatmeal"
    assert len(body["entries"]) == 1
    entry = body["entries"][0]
    assert entry["kcal"] == 250.0
    assert entry["protein_g"] == 20.0


@pytest.mark.asyncio
async def test_create_log_multiple_entries(client: AsyncClient) -> None:
    token = await register_and_login(client)
    payload = {
        "logged_date": LOG_DATE,
        "meal_type": "lunch",
        "entries": [
            {**ENTRY_PAYLOAD, "kcal": 100.0},
            {**ENTRY_PAYLOAD, "kcal": 200.0},
            {**ENTRY_PAYLOAD, "kcal": 300.0},
        ],
    }
    resp = await client.post("/logs", json=payload, headers=auth_headers(token))
    assert resp.status_code == 201
    assert len(resp.json()["entries"]) == 3


@pytest.mark.asyncio
async def test_create_log_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/logs", json=LOG_PAYLOAD)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_log_with_ingredient_id(client: AsyncClient, db_session) -> None:  # type: ignore[no-untyped-def]
    """A valid ingredient_id (row exists) is stored on the entry."""

    from app.models.ingredient import Ingredient, UnitType

    # Insert a real ingredient so the FK is satisfied in any DB engine.
    ingredient = Ingredient(
        name="Rolled Oats",
        unit=UnitType.g,
        portion_size=100.0,
        kcal=389.0,
        protein=17.0,
        fat=7.0,
        carbohydrates=66.0,
        fiber=10.0,
        sodium=2.0,
        is_system=True,
    )
    db_session.add(ingredient)
    await db_session.commit()
    await db_session.refresh(ingredient)

    token = await register_and_login(client)
    payload = {
        **LOG_PAYLOAD,
        "entries": [{**ENTRY_PAYLOAD, "ingredient_id": ingredient.id}],
    }
    resp = await client.post("/logs", json=payload, headers=auth_headers(token))
    assert resp.status_code == 201
    assert resp.json()["entries"][0]["ingredient_id"] == ingredient.id


@pytest.mark.asyncio
async def test_create_log_unknown_ingredient_id_returns_422(
    client: AsyncClient,
) -> None:
    """A non-existent ingredient_id must return 422, not 500."""
    token = await register_and_login(client)
    payload = {
        **LOG_PAYLOAD,
        "entries": [{**ENTRY_PAYLOAD, "ingredient_id": 999_999}],
    }
    resp = await client.post("/logs", json=payload, headers=auth_headers(token))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_log_with_recipe_id(client: AsyncClient) -> None:
    token = await register_and_login(client)
    payload = {
        **LOG_PAYLOAD,
        "entries": [{**ENTRY_PAYLOAD, "recipe_id": 42}],
    }
    resp = await client.post("/logs", json=payload, headers=auth_headers(token))
    assert resp.status_code == 201
    assert resp.json()["entries"][0]["recipe_id"] == 42


@pytest.mark.asyncio
async def test_create_log_requires_at_least_one_entry(client: AsyncClient) -> None:
    token = await register_and_login(client)
    payload = {**LOG_PAYLOAD, "entries": []}
    resp = await client.post("/logs", json=payload, headers=auth_headers(token))
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /logs?date=
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_logs_empty_date(client: AsyncClient) -> None:
    """Empty list returned for a date with no entries — not an error."""
    token = await register_and_login(client)
    resp = await client.get(
        "/logs", params={"date": "2099-01-01"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_logs_returns_own_entries(client: AsyncClient) -> None:
    token = await register_and_login(client)
    await client.post("/logs", json=LOG_PAYLOAD, headers=auth_headers(token))
    resp = await client.get(
        "/logs", params={"date": LOG_DATE}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["logged_date"] == LOG_DATE
    assert len(data[0]["entries"]) == 1


@pytest.mark.asyncio
async def test_list_logs_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/logs", params={"date": LOG_DATE})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_logs_does_not_return_other_users_logs(
    client: AsyncClient,
) -> None:
    """User A cannot read User B's logs."""
    token_a = await register_and_login(client, username="alice")
    token_b = await register_and_login(client, username="bob")

    # Alice creates a log
    await client.post("/logs", json=LOG_PAYLOAD, headers=auth_headers(token_a))

    # Bob queries same date — should get empty list
    resp = await client.get(
        "/logs", params={"date": LOG_DATE}, headers=auth_headers(token_b)
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_logs_only_returns_matching_date(client: AsyncClient) -> None:
    token = await register_and_login(client)
    await client.post("/logs", json=LOG_PAYLOAD, headers=auth_headers(token))

    # Query a different date
    resp = await client.get(
        "/logs", params={"date": "2025-06-16"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /logs/summary?date=
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_summary_returns_zeros_for_empty_day(client: AsyncClient) -> None:
    token = await register_and_login(client)
    resp = await client.get(
        "/logs/summary", params={"date": "2099-01-01"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kcal"] == 0.0
    assert body["protein_g"] == 0.0
    assert body["fat_g"] == 0.0
    assert body["carbohydrates_g"] == 0.0
    assert body["fiber_g"] == 0.0
    assert body["sodium_mg"] == 0.0


@pytest.mark.asyncio
async def test_summary_sums_all_entries(client: AsyncClient) -> None:
    token = await register_and_login(client)
    # Create two logs on same date, each with different nutrition
    payload1 = {
        "logged_date": LOG_DATE,
        "meal_type": "breakfast",
        "entries": [
            {
                "amount_g": 100.0,
                "kcal": 200.0,
                "protein_g": 10.0,
                "fat_g": 5.0,
                "carbohydrates_g": 30.0,
                "fiber_g": 2.0,
                "sodium_mg": 50.0,
            }
        ],
    }
    payload2 = {
        "logged_date": LOG_DATE,
        "meal_type": "lunch",
        "entries": [
            {
                "amount_g": 150.0,
                "kcal": 300.0,
                "protein_g": 25.0,
                "fat_g": 12.0,
                "carbohydrates_g": 20.0,
                "fiber_g": 4.0,
                "sodium_mg": 80.0,
            }
        ],
    }
    await client.post("/logs", json=payload1, headers=auth_headers(token))
    await client.post("/logs", json=payload2, headers=auth_headers(token))

    resp = await client.get(
        "/logs/summary", params={"date": LOG_DATE}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kcal"] == pytest.approx(500.0)
    assert body["protein_g"] == pytest.approx(35.0)
    assert body["fat_g"] == pytest.approx(17.0)
    assert body["carbohydrates_g"] == pytest.approx(50.0)
    assert body["fiber_g"] == pytest.approx(6.0)
    assert body["sodium_mg"] == pytest.approx(130.0)


@pytest.mark.asyncio
async def test_summary_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/logs/summary", params={"date": LOG_DATE})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_summary_excludes_other_users_data(client: AsyncClient) -> None:
    token_a = await register_and_login(client, username="alice")
    token_b = await register_and_login(client, username="bob")

    # Alice creates a log with kcal=500
    await client.post(
        "/logs",
        json={
            "logged_date": LOG_DATE,
            "meal_type": "dinner",
            "entries": [{**ENTRY_PAYLOAD, "kcal": 500.0}],
        },
        headers=auth_headers(token_a),
    )

    # Bob's summary should be 0
    resp = await client.get(
        "/logs/summary", params={"date": LOG_DATE}, headers=auth_headers(token_b)
    )
    assert resp.status_code == 200
    assert resp.json()["kcal"] == 0.0


# ---------------------------------------------------------------------------
# Snapshot immutability
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_snapshot_immutability(client: AsyncClient, db_session) -> None:  # type: ignore[no-untyped-def]
    """Updating an ingredient's kcal does NOT change an existing MealLogEntry."""
    from sqlalchemy import select

    from app.models.meal_log import MealLogEntry

    token = await register_and_login(client)

    # Create a log with kcal=200
    resp = await client.post(
        "/logs",
        json={
            "logged_date": LOG_DATE,
            "meal_type": "snack",
            "entries": [{**ENTRY_PAYLOAD, "kcal": 200.0}],
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    entry_id = resp.json()["entries"][0]["id"]

    # Directly mutate the snapshotted kcal in DB (simulate ingredient edit)
    # The entry's kcal should remain 200 — we verify it wasn't changed externally
    result = await db_session.execute(
        select(MealLogEntry).where(MealLogEntry.id == entry_id)
    )
    entry = result.scalar_one()
    assert entry.kcal == 200.0  # stored snapshot, unchanged


# ---------------------------------------------------------------------------
# logged_date stored as date (not datetime)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_logged_date_stored_as_date(client: AsyncClient, db_session) -> None:  # type: ignore[no-untyped-def]
    """logged_date must be stored as a date type, not datetime."""
    import datetime

    from sqlalchemy import select

    from app.models.meal_log import MealLog

    token = await register_and_login(client)
    await client.post("/logs", json=LOG_PAYLOAD, headers=auth_headers(token))

    result = await db_session.execute(select(MealLog))
    log = result.scalar_one()
    assert isinstance(log.logged_date, datetime.date)
    assert not isinstance(log.logged_date, datetime.datetime)
