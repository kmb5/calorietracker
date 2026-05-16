"""Tests for /logs/calendar and /logs/weekly-summary endpoints."""

from datetime import date

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meal_log import MealLog, MealLogEntry, MealType

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_log_with_entries(
    db: AsyncSession,
    user_id: int,
    logged_date: date,
    meal_type: MealType = MealType.lunch,
    entries: list[dict] | None = None,
) -> MealLog:
    """Create a MealLog with one or more MealLogEntry rows directly in the DB."""
    if entries is None:
        entries = [
            {
                "kcal": 200.0,
                "protein_g": 10.0,
                "fat_g": 5.0,
                "carbohydrates_g": 30.0,
                "fiber_g": 3.0,
                "sodium_mg": 50.0,
                "amount_g": 100.0,
            }
        ]
    meal_log = MealLog(
        user_id=user_id,
        logged_date=logged_date,
        meal_type=meal_type,
    )
    db.add(meal_log)
    await db.flush()  # get meal_log.id

    for entry_data in entries:
        entry = MealLogEntry(
            meal_log_id=meal_log.id,
            user_id=user_id,
            logged_date=logged_date,
            amount_g=entry_data.get("amount_g", 100.0),
            kcal=entry_data["kcal"],
            protein_g=entry_data["protein_g"],
            fat_g=entry_data["fat_g"],
            carbohydrates_g=entry_data["carbohydrates_g"],
            fiber_g=entry_data["fiber_g"],
            sodium_mg=entry_data["sodium_mg"],
        )
        db.add(entry)

    await db.commit()
    return meal_log


# ---------------------------------------------------------------------------
# GET /logs/calendar
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_calendar_requires_auth(client: AsyncClient):
    resp = await client.get("/logs/calendar", params={"year": 2026, "month": 1})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_calendar_empty_month(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, "alice")
    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 1},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_calendar_returns_day_summaries(
    client: AsyncClient, db_session: AsyncSession
):
    token = await register_and_login(client, "alice")
    # Get user id from DB
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    # Create entries on two different days in January 2026
    await _create_log_with_entries(
        db_session,
        user.id,
        date(2026, 1, 10),
        entries=[
            {
                "kcal": 500.0,
                "protein_g": 30.0,
                "fat_g": 20.0,
                "carbohydrates_g": 50.0,
                "fiber_g": 5.0,
                "sodium_mg": 100.0,
                "amount_g": 200.0,
            }
        ],
    )
    await _create_log_with_entries(
        db_session,
        user.id,
        date(2026, 1, 15),
        entries=[
            {
                "kcal": 300.0,
                "protein_g": 20.0,
                "fat_g": 10.0,
                "carbohydrates_g": 40.0,
                "fiber_g": 2.0,
                "sodium_mg": 60.0,
                "amount_g": 150.0,
            }
        ],
    )

    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 1},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    day10 = next(d for d in data if d["date"] == "2026-01-10")
    assert day10["total_kcal"] == pytest.approx(500.0)
    assert day10["total_protein_g"] == pytest.approx(30.0)
    assert day10["total_fat_g"] == pytest.approx(20.0)
    assert day10["total_carbs_g"] == pytest.approx(50.0)
    assert day10["entry_count"] == 1

    day15 = next(d for d in data if d["date"] == "2026-01-15")
    assert day15["total_kcal"] == pytest.approx(300.0)


@pytest.mark.asyncio
async def test_calendar_sums_multiple_meal_types(
    client: AsyncClient, db_session: AsyncSession
):
    """Entries across multiple meal types on the same day must be summed together."""
    token = await register_and_login(client, "alice")
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    day = date(2026, 2, 5)
    await _create_log_with_entries(
        db_session,
        user.id,
        day,
        meal_type=MealType.breakfast,
        entries=[
            {
                "kcal": 400.0,
                "protein_g": 15.0,
                "fat_g": 10.0,
                "carbohydrates_g": 60.0,
                "fiber_g": 4.0,
                "sodium_mg": 80.0,
                "amount_g": 100.0,
            }
        ],
    )
    await _create_log_with_entries(
        db_session,
        user.id,
        day,
        meal_type=MealType.dinner,
        entries=[
            {
                "kcal": 600.0,
                "protein_g": 40.0,
                "fat_g": 25.0,
                "carbohydrates_g": 70.0,
                "fiber_g": 6.0,
                "sodium_mg": 200.0,
                "amount_g": 250.0,
            }
        ],
    )

    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 2},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    day_sum = data[0]
    assert day_sum["date"] == "2026-02-05"
    assert day_sum["total_kcal"] == pytest.approx(1000.0)
    assert day_sum["total_protein_g"] == pytest.approx(55.0)
    assert day_sum["total_fat_g"] == pytest.approx(35.0)
    assert day_sum["total_carbs_g"] == pytest.approx(130.0)
    assert day_sum["entry_count"] == 2


@pytest.mark.asyncio
async def test_calendar_omits_days_without_entries(
    client: AsyncClient, db_session: AsyncSession
):
    """Days with no entries must not appear in the response."""
    token = await register_and_login(client, "alice")
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    # Entry only on the 3rd — other days in the month should not appear
    await _create_log_with_entries(db_session, user.id, date(2026, 3, 3))

    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 3},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["date"] == "2026-03-03"


@pytest.mark.asyncio
async def test_calendar_only_returns_own_data(
    client: AsyncClient, db_session: AsyncSession
):
    """User B's entries must not appear in user A's calendar response."""
    token_a = await register_and_login(client, "alice")
    await register_and_login(client, "bob")

    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "bob"))
    bob = result.scalar_one()

    await _create_log_with_entries(db_session, bob.id, date(2026, 4, 1))

    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 4},
        headers=auth_headers(token_a),
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_calendar_invalid_params(client: AsyncClient):
    token = await register_and_login(client, "alice")
    # Missing year
    resp = await client.get(
        "/logs/calendar", params={"month": 1}, headers=auth_headers(token)
    )
    assert resp.status_code == 422

    # Invalid month (0)
    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 0},
        headers=auth_headers(token),
    )
    assert resp.status_code == 422

    # Invalid month (13)
    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 13},
        headers=auth_headers(token),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /logs/weekly-summary
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_weekly_summary_requires_auth(client: AsyncClient):
    resp = await client.get("/logs/weekly-summary", params={"end_date": "2026-02-03"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_weekly_summary_end_date(client: AsyncClient, db_session: AsyncSession):
    """end_date=2026-02-03 should return Jan 28 – Feb 3 (7 days)."""
    token = await register_and_login(client, "alice")
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    # Create entries on Jan 28, Jan 31, and Feb 2
    for d in [date(2026, 1, 28), date(2026, 1, 31), date(2026, 2, 2)]:
        await _create_log_with_entries(db_session, user.id, d)

    # Feb 4 — outside the window, should not appear
    await _create_log_with_entries(db_session, user.id, date(2026, 2, 4))

    resp = await client.get(
        "/logs/weekly-summary",
        params={"end_date": "2026-02-03"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    dates_in_response = {d["date"] for d in data}
    assert dates_in_response == {"2026-01-28", "2026-01-31", "2026-02-02"}


@pytest.mark.asyncio
async def test_weekly_summary_default_end_date(
    client: AsyncClient, db_session: AsyncSession
):
    """No end_date param → defaults to today, returns at most 7 days."""
    token = await register_and_login(client, "alice")
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    today = date.today()
    await _create_log_with_entries(db_session, user.id, today)

    resp = await client.get(
        "/logs/weekly-summary",
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["date"] == today.isoformat()


@pytest.mark.asyncio
async def test_weekly_summary_omits_empty_days(
    client: AsyncClient, db_session: AsyncSession
):
    """Days without entries must be omitted from weekly summary."""
    token = await register_and_login(client, "alice")
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    # Only Jan 29 has an entry in the week Jan 28 – Feb 3
    await _create_log_with_entries(db_session, user.id, date(2026, 1, 29))

    resp = await client.get(
        "/logs/weekly-summary",
        params={"end_date": "2026-02-03"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["date"] == "2026-01-29"


@pytest.mark.asyncio
async def test_weekly_summary_only_own_data(
    client: AsyncClient, db_session: AsyncSession
):
    token_a = await register_and_login(client, "alice")
    await register_and_login(client, "bob")

    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "bob"))
    bob = result.scalar_one()

    await _create_log_with_entries(db_session, bob.id, date(2026, 5, 1))

    resp = await client.get(
        "/logs/weekly-summary",
        params={"end_date": "2026-05-03"},
        headers=auth_headers(token_a),
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_weekly_summary_invalid_end_date(client: AsyncClient):
    token = await register_and_login(client, "alice")
    resp = await client.get(
        "/logs/weekly-summary",
        params={"end_date": "not-a-date"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_weekly_summary_spans_two_months(
    client: AsyncClient, db_session: AsyncSession
):
    """Week spanning month boundary (Jan 28 – Feb 3) is handled correctly."""
    token = await register_and_login(client, "alice")
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    await _create_log_with_entries(db_session, user.id, date(2026, 1, 30))
    await _create_log_with_entries(db_session, user.id, date(2026, 2, 1))

    resp = await client.get(
        "/logs/weekly-summary",
        params={"end_date": "2026-02-03"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    dates_in_response = {d["date"] for d in data}
    assert "2026-01-30" in dates_in_response
    assert "2026-02-01" in dates_in_response


@pytest.mark.asyncio
async def test_calendar_december_end_of_year(
    client: AsyncClient, db_session: AsyncSession
):
    """December month boundary handled correctly (next month is Jan of next year)."""
    token = await register_and_login(client, "alice")
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "alice"))
    user = result.scalar_one()

    await _create_log_with_entries(db_session, user.id, date(2026, 12, 31))
    # Jan 1 of 2027 should NOT appear in December 2026 calendar
    await _create_log_with_entries(db_session, user.id, date(2027, 1, 1))

    resp = await client.get(
        "/logs/calendar",
        params={"year": 2026, "month": 12},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["date"] == "2026-12-31"
