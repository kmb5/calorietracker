"""Calendar aggregation endpoints: /logs/calendar and /logs/weekly-summary."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.meal_log import MealLogEntry
from app.models.user import User
from app.schemas.calendar import DaySummary

router = APIRouter(prefix="/logs", tags=["logs"])


async def _aggregate_date_range(
    db: AsyncSession,
    user_id: int,
    start_date: date,
    end_date: date,
) -> list[DaySummary]:
    """Aggregate MealLogEntry rows grouped by logged_date in [start_date, end_date]."""
    stmt = (
        select(
            MealLogEntry.logged_date,
            func.sum(MealLogEntry.kcal).label("total_kcal"),
            func.sum(MealLogEntry.protein_g).label("total_protein_g"),
            func.sum(MealLogEntry.fat_g).label("total_fat_g"),
            func.sum(MealLogEntry.carbohydrates_g).label("total_carbs_g"),
            func.count(MealLogEntry.id).label("entry_count"),
        )
        .where(
            MealLogEntry.user_id == user_id,
            MealLogEntry.logged_date >= start_date,
            MealLogEntry.logged_date <= end_date,
        )
        .group_by(MealLogEntry.logged_date)
        .order_by(MealLogEntry.logged_date)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        DaySummary(
            date=row.logged_date,
            total_kcal=row.total_kcal,
            total_protein_g=row.total_protein_g,
            total_fat_g=row.total_fat_g,
            total_carbs_g=row.total_carbs_g,
            entry_count=row.entry_count,
        )
        for row in rows
    ]


@router.get("/calendar", response_model=list[DaySummary])
async def get_calendar(
    year: int = Query(ge=1900, le=2200),
    month: int = Query(ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DaySummary]:
    """Return DaySummary for every day with entries in the requested month."""
    start_date = date(year, month, 1)
    # Last day of the month
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    return await _aggregate_date_range(db, current_user.id, start_date, end_date)


@router.get("/weekly-summary", response_model=list[DaySummary])
async def get_weekly_summary(
    end_date: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DaySummary]:
    """Return DaySummary for the 7 calendar days ending on end_date (inclusive).

    Defaults to today if end_date is not provided. Days with no entries are omitted.
    """
    if end_date is None:
        end_date = date.today()
    start_date = end_date - timedelta(days=6)

    return await _aggregate_date_range(db, current_user.id, start_date, end_date)
