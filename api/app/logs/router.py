"""Logs router — streak and future meal log endpoints."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.meal_log import MealLog
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["logs"])


class StreakResponse(BaseModel):
    current_streak_days: int
    longest_streak_days: int


def _calculate_streaks(dates: list[date], today: date) -> tuple[int, int]:
    """Calculate current and longest streaks from a sorted (desc) list of unique logged dates.

    - current: consecutive days ending at today or yesterday
    - longest: longest run in entire history
    """
    if not dates:
        return 0, 0

    # Determine anchor: start current streak from today or yesterday
    anchor = today if today in set(dates) else today - timedelta(days=1)

    # Calculate current streak from anchor going backwards
    current = 0
    expected = anchor
    for d in sorted(set(dates), reverse=True):
        if d > anchor:
            continue
        if d == expected:
            current += 1
            expected -= timedelta(days=1)
        elif d < expected:
            break

    # Calculate longest streak across all dates
    sorted_dates = sorted(set(dates))
    longest = 0
    run = 1
    for i in range(1, len(sorted_dates)):
        if sorted_dates[i] == sorted_dates[i - 1] + timedelta(days=1):
            run += 1
        else:
            longest = max(longest, run)
            run = 1
    longest = max(longest, run)

    return current, longest


@router.get("/streak", response_model=StreakResponse)
async def get_streak(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> StreakResponse:
    """Return current and longest logging streaks for the authenticated user."""
    result = await session.execute(
        select(func.distinct(MealLog.logged_date))
        .where(MealLog.user_id == current_user.id)
        .order_by(MealLog.logged_date.desc())
    )
    raw_dates = [row[0] for row in result.fetchall()]
    # SQLite returns dates as strings; Postgres returns date objects
    dates: list[date] = [
        date.fromisoformat(d) if isinstance(d, str) else d for d in raw_dates
    ]

    today = date.today()
    current, longest = _calculate_streaks(dates, today)

    return StreakResponse(
        current_streak_days=current,
        longest_streak_days=longest,
    )
