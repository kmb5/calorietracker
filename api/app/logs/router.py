"""Meal log endpoints: list by date, create, daily summary."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.ingredient import Ingredient
from app.models.meal_log import MealLog, MealLogEntry
from app.models.user import User
from app.schemas.meal_log import DailySummary, MealLogCreate, MealLogRead

router = APIRouter(prefix="/logs", tags=["logs"])


# ---------------------------------------------------------------------------
# GET /logs?date=YYYY-MM-DD
# ---------------------------------------------------------------------------


@router.get("", response_model=list[MealLogRead])
async def list_logs(
    date: date = Query(..., alias="date"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[MealLog]:
    """Return all MealLogs (with entries) for the given calendar date.

    Only returns logs belonging to the authenticated user.
    Returns an empty list when no entries exist for that date.
    """
    stmt = (
        select(MealLog)
        .where(
            MealLog.user_id == current_user.id,
            MealLog.logged_date == date,
        )
        .options(selectinload(MealLog.entries))
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# POST /logs
# ---------------------------------------------------------------------------


@router.post("", response_model=MealLogRead, status_code=status.HTTP_201_CREATED)
async def create_log(
    body: MealLogCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MealLog:
    """Create a MealLog with one or more MealLogEntry rows.

    Nutrition values are provided by the client and stored as-is (snapshot).
    The server never recomputes nutrition from ingredient data.
    """
    # Pre-flight: validate every ingredient_id that was supplied.
    # Querying before insert means this check works on both SQLite (tests)
    # and PostgreSQL (production), rather than relying on IntegrityError which
    # SQLite silently swallows when FK enforcement is off.
    for entry_data in body.entries:
        if entry_data.ingredient_id is not None:
            exists = await session.get(Ingredient, entry_data.ingredient_id)
            if exists is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"ingredient_id {entry_data.ingredient_id} does not exist",
                )

    log = MealLog(
        user_id=current_user.id,
        logged_date=body.logged_date,
        meal_type=body.meal_type,
        name=body.name,
        notes=body.notes,
    )
    session.add(log)
    await session.flush()  # Get the generated log.id

    for entry_data in body.entries:
        entry = MealLogEntry(
            meal_log_id=log.id,
            ingredient_id=entry_data.ingredient_id,
            recipe_id=entry_data.recipe_id,
            amount_g=entry_data.amount_g,
            kcal=entry_data.kcal,
            protein_g=entry_data.protein_g,
            fat_g=entry_data.fat_g,
            carbohydrates_g=entry_data.carbohydrates_g,
            fiber_g=entry_data.fiber_g,
            sodium_mg=entry_data.sodium_mg,
        )
        session.add(entry)

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="ingredient_id references a non-existent ingredient",
        )

    # Re-fetch with entries loaded
    stmt = (
        select(MealLog)
        .where(MealLog.id == log.id)
        .options(selectinload(MealLog.entries))
    )
    result = await session.execute(stmt)
    return result.scalar_one()


# ---------------------------------------------------------------------------
# GET /logs/summary?date=YYYY-MM-DD
# ---------------------------------------------------------------------------


@router.get("/summary", response_model=DailySummary)
async def daily_summary(
    date: date = Query(..., alias="date"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> DailySummary:
    """Return summed macro totals for all entries on the given calendar date.

    Returns zero-valued fields when no entries exist for that date.
    """
    # Join MealLogEntry → MealLog to filter by user and date
    stmt = (
        select(
            func.coalesce(func.sum(MealLogEntry.kcal), 0.0).label("kcal"),
            func.coalesce(func.sum(MealLogEntry.protein_g), 0.0).label("protein_g"),
            func.coalesce(func.sum(MealLogEntry.fat_g), 0.0).label("fat_g"),
            func.coalesce(func.sum(MealLogEntry.carbohydrates_g), 0.0).label(
                "carbohydrates_g"
            ),
            func.coalesce(func.sum(MealLogEntry.fiber_g), 0.0).label("fiber_g"),
            func.coalesce(func.sum(MealLogEntry.sodium_mg), 0.0).label("sodium_mg"),
        )
        .select_from(MealLogEntry)
        .join(MealLog, MealLog.id == MealLogEntry.meal_log_id)
        .where(
            MealLog.user_id == current_user.id,
            MealLog.logged_date == date,
        )
    )

    result = await session.execute(stmt)
    row = result.one()

    return DailySummary(
        logged_date=date,
        kcal=row.kcal,
        protein_g=row.protein_g,
        fat_g=row.fat_g,
        carbohydrates_g=row.carbohydrates_g,
        fiber_g=row.fiber_g,
        sodium_mg=row.sodium_mg,
    )
