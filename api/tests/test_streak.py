"""Tests for GET /logs/streak endpoint."""

from datetime import date, timedelta

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meal_log import MealLog, MealType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_meal_log(
    session: AsyncSession,
    *,
    user_id: int,
    logged_date: date,
    meal_type: MealType = MealType.lunch,
) -> MealLog:
    log = MealLog(user_id=user_id, logged_date=logged_date, meal_type=meal_type)
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log


async def _get_user_id(session: AsyncSession, username: str) -> int:
    from sqlalchemy import select

    from app.models.user import User

    result = await session.execute(select(User).where(User.username == username))
    user = result.scalar_one()
    return user.id


# ---------------------------------------------------------------------------
# Streak endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_streak_requires_auth(client: AsyncClient):
    resp = await client.get("/logs/streak")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_streak_no_entries(client: AsyncClient):
    """No log entries → both streaks are 0."""
    token = await register_and_login(client, "alice_streak")
    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 0
    assert data["longest_streak_days"] == 0


@pytest.mark.asyncio
async def test_streak_single_day_today(
    client: AsyncClient, db_session: AsyncSession
):
    """Single log today → current_streak = 1."""
    token = await register_and_login(client, "bob_streak")
    user_id = await _get_user_id(db_session, "bob_streak")

    today = date.today()
    await _create_meal_log(db_session, user_id=user_id, logged_date=today)

    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 1
    assert data["longest_streak_days"] == 1


@pytest.mark.asyncio
async def test_streak_five_consecutive_days(
    client: AsyncClient, db_session: AsyncSession
):
    """Five consecutive days ending today → current_streak = 5."""
    token = await register_and_login(client, "carol_streak")
    user_id = await _get_user_id(db_session, "carol_streak")

    today = date.today()
    for i in range(5):
        await _create_meal_log(
            db_session, user_id=user_id, logged_date=today - timedelta(days=i)
        )

    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 5
    assert data["longest_streak_days"] == 5


@pytest.mark.asyncio
async def test_streak_broken_by_gap(
    client: AsyncClient, db_session: AsyncSession
):
    """A gap breaks the current streak; the longer historical run is reflected in longest."""
    token = await register_and_login(client, "dave_streak")
    user_id = await _get_user_id(db_session, "dave_streak")

    today = date.today()
    # Today + yesterday = 2 consecutive
    await _create_meal_log(db_session, user_id=user_id, logged_date=today)
    await _create_meal_log(db_session, user_id=user_id, logged_date=today - timedelta(days=1))
    # Gap: day -2 missing
    # 3 consecutive days further back (days -3, -4, -5)
    for i in range(3, 6):
        await _create_meal_log(
            db_session, user_id=user_id, logged_date=today - timedelta(days=i)
        )

    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 2
    assert data["longest_streak_days"] == 3


@pytest.mark.asyncio
async def test_streak_today_empty_yesterday_logged(
    client: AsyncClient, db_session: AsyncSession
):
    """Today has no entries but yesterday does — streak counts from yesterday."""
    token = await register_and_login(client, "eve_streak")
    user_id = await _get_user_id(db_session, "eve_streak")

    today = date.today()
    yesterday = today - timedelta(days=1)
    day_before = today - timedelta(days=2)

    await _create_meal_log(db_session, user_id=user_id, logged_date=yesterday)
    await _create_meal_log(db_session, user_id=user_id, logged_date=day_before)

    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 2


@pytest.mark.asyncio
async def test_streak_today_neither_today_nor_yesterday(
    client: AsyncClient, db_session: AsyncSession
):
    """Gap of more than 1 day from today → current_streak = 0."""
    token = await register_and_login(client, "frank_streak")
    user_id = await _get_user_id(db_session, "frank_streak")

    today = date.today()
    # Last log was 3 days ago
    await _create_meal_log(
        db_session, user_id=user_id, logged_date=today - timedelta(days=3)
    )
    await _create_meal_log(
        db_session, user_id=user_id, logged_date=today - timedelta(days=4)
    )

    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 0
    assert data["longest_streak_days"] == 2


@pytest.mark.asyncio
async def test_streak_longest_differs_from_current(
    client: AsyncClient, db_session: AsyncSession
):
    """Longest streak in history is longer than current streak."""
    token = await register_and_login(client, "grace_streak")
    user_id = await _get_user_id(db_session, "grace_streak")

    today = date.today()
    # Old streak of 7 days (21 to 27 days ago)
    for i in range(21, 28):
        await _create_meal_log(
            db_session, user_id=user_id, logged_date=today - timedelta(days=i)
        )
    # Current streak of 1 day (just today)
    await _create_meal_log(db_session, user_id=user_id, logged_date=today)

    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 1
    assert data["longest_streak_days"] == 7


@pytest.mark.asyncio
async def test_streak_no_cross_user_data(
    client: AsyncClient, db_session: AsyncSession
):
    """Streak does not include data from other users."""
    token_a = await register_and_login(client, "user_a_streak")
    user_a_id = await _get_user_id(db_session, "user_a_streak")

    await register_and_login(client, "user_b_streak")
    user_b_id = await _get_user_id(db_session, "user_b_streak")

    today = date.today()
    # User B has 5 days of logs
    for i in range(5):
        await _create_meal_log(
            db_session, user_id=user_b_id, logged_date=today - timedelta(days=i)
        )

    # User A has no logs
    resp = await client.get("/logs/streak", headers=auth_headers(token_a))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 0
    assert data["longest_streak_days"] == 0

    _ = user_a_id  # used implicitly via user A's token


@pytest.mark.asyncio
async def test_streak_multiple_logs_same_day(
    client: AsyncClient, db_session: AsyncSession
):
    """Multiple log entries on the same day count as one day in the streak."""
    token = await register_and_login(client, "heidi_streak")
    user_id = await _get_user_id(db_session, "heidi_streak")

    today = date.today()
    # 3 logs on today, 2 logs on yesterday
    for _ in range(3):
        await _create_meal_log(db_session, user_id=user_id, logged_date=today)
    for _ in range(2):
        await _create_meal_log(
            db_session, user_id=user_id, logged_date=today - timedelta(days=1)
        )

    resp = await client.get("/logs/streak", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak_days"] == 2
    assert data["longest_streak_days"] == 2
