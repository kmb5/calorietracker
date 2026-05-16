"""Meal log endpoints: CRUD for MealLog and MealLogEntry."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.meal_log import MealLog, MealLogEntry
from app.models.user import User
from app.schemas.meal_log import (
    DailySummary,
    MealLogCreate,
    MealLogEntryCreate,
    MealLogEntryResponse,
    MealLogEntryUpdate,
    MealLogResponse,
    MealLogUpdate,
)

router = APIRouter(prefix="/logs", tags=["logs"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_meal_log_or_404(
    log_id: int,
    current_user: User,
    session: AsyncSession,
) -> MealLog:
    """Fetch a MealLog owned by the current user, or raise 404."""
    result = await session.execute(select(MealLog).where(MealLog.id == log_id))
    meal_log = result.scalar_one_or_none()
    # Return 404 for both "not found" and "belongs to another user"
    if meal_log is None or meal_log.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Log not found"
        )
    return meal_log


async def _get_entry_or_404(
    meal_log: MealLog,
    entry_id: int,
    session: AsyncSession,
) -> MealLogEntry:
    """Fetch a MealLogEntry belonging to the given MealLog, or raise 404."""
    result = await session.execute(
        select(MealLogEntry).where(
            MealLogEntry.id == entry_id,
            MealLogEntry.meal_log_id == meal_log.id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found"
        )
    return entry


def _create_entry(meal_log_id: int, data: MealLogEntryCreate) -> MealLogEntry:
    return MealLogEntry(
        meal_log_id=meal_log_id,
        ingredient_id=data.ingredient_id,
        recipe_id=data.recipe_id,
        amount_g=data.amount_g,
        kcal=data.kcal,
        protein_g=data.protein_g,
        fat_g=data.fat_g,
        carbohydrates_g=data.carbohydrates_g,
        fiber_g=data.fiber_g,
        sodium_mg=data.sodium_mg,
    )


# ---------------------------------------------------------------------------
# GET /logs?date=YYYY-MM-DD
# ---------------------------------------------------------------------------


@router.get("", response_model=list[MealLogResponse])
async def list_logs(
    date: date = Query(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[MealLog]:
    """Return all MealLogs with entries for a calendar date (caller's own only)."""
    result = await session.execute(
        select(MealLog).where(
            MealLog.user_id == current_user.id,
            MealLog.logged_date == date,
        )
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# POST /logs
# ---------------------------------------------------------------------------


@router.post("", response_model=MealLogResponse, status_code=status.HTTP_201_CREATED)
async def create_log(
    payload: MealLogCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MealLog:
    """Create a MealLog with one or more entries. Nutrition is snapshotted at write time."""
    meal_log = MealLog(
        user_id=current_user.id,
        logged_date=payload.logged_date,
        meal_type=payload.meal_type,
        name=payload.name,
        notes=payload.notes,
    )
    session.add(meal_log)
    await session.flush()  # get meal_log.id

    for entry_data in payload.entries:
        entry = _create_entry(meal_log.id, entry_data)
        session.add(entry)

    await session.commit()
    await session.refresh(meal_log)
    return meal_log


# ---------------------------------------------------------------------------
# GET /logs/summary?date=YYYY-MM-DD
# ---------------------------------------------------------------------------


@router.get("/summary", response_model=DailySummary)
async def daily_summary(
    date: date = Query(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> DailySummary:
    """Return summed macro totals across all entries for the day."""
    result = await session.execute(
        select(MealLog).where(
            MealLog.user_id == current_user.id,
            MealLog.logged_date == date,
        )
    )
    logs = list(result.scalars().all())

    totals = DailySummary(
        logged_date=date,
        kcal=0.0,
        protein_g=0.0,
        fat_g=0.0,
        carbohydrates_g=0.0,
        fiber_g=0.0,
        sodium_mg=0.0,
    )
    for log in logs:
        for entry in log.entries:
            totals.kcal += entry.kcal
            totals.protein_g += entry.protein_g
            totals.fat_g += entry.fat_g
            totals.carbohydrates_g += entry.carbohydrates_g
            totals.fiber_g += entry.fiber_g
            totals.sodium_mg += entry.sodium_mg
    return totals


# ---------------------------------------------------------------------------
# PATCH /logs/{id}
# ---------------------------------------------------------------------------


@router.patch("/{log_id}", response_model=MealLogResponse)
async def update_log(
    log_id: int,
    payload: MealLogUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MealLog:
    """Update meal_type and/or notes on a MealLog."""
    meal_log = await _get_meal_log_or_404(log_id, current_user, session)

    if payload.meal_type is not None:
        meal_log.meal_type = payload.meal_type
    if payload.notes is not None:
        meal_log.notes = payload.notes

    await session.commit()
    await session.refresh(meal_log)
    return meal_log


# ---------------------------------------------------------------------------
# DELETE /logs/{id}
# ---------------------------------------------------------------------------


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a MealLog and all its MealLogEntry rows (cascade)."""
    meal_log = await _get_meal_log_or_404(log_id, current_user, session)
    await session.delete(meal_log)
    await session.commit()


# ---------------------------------------------------------------------------
# POST /logs/{id}/entries
# ---------------------------------------------------------------------------


@router.post(
    "/{log_id}/entries",
    response_model=MealLogEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_entry(
    log_id: int,
    payload: MealLogEntryCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MealLogEntry:
    """Add a new MealLogEntry to an existing MealLog."""
    meal_log = await _get_meal_log_or_404(log_id, current_user, session)
    entry = _create_entry(meal_log.id, payload)
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# PATCH /logs/{id}/entries/{entry_id}
# ---------------------------------------------------------------------------


@router.patch("/{log_id}/entries/{entry_id}", response_model=MealLogEntryResponse)
async def update_entry(
    log_id: int,
    entry_id: int,
    payload: MealLogEntryUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MealLogEntry:
    """Update amount_g and recalculate the nutrition snapshot proportionally."""
    meal_log = await _get_meal_log_or_404(log_id, current_user, session)
    entry = await _get_entry_or_404(meal_log, entry_id, session)

    if entry.amount_g == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot recalculate: original amount_g is zero",
        )

    ratio = payload.amount_g / entry.amount_g
    entry.kcal = round(entry.kcal * ratio, 6)
    entry.protein_g = round(entry.protein_g * ratio, 6)
    entry.fat_g = round(entry.fat_g * ratio, 6)
    entry.carbohydrates_g = round(entry.carbohydrates_g * ratio, 6)
    entry.fiber_g = round(entry.fiber_g * ratio, 6)
    entry.sodium_mg = round(entry.sodium_mg * ratio, 6)
    entry.amount_g = payload.amount_g

    await session.commit()
    await session.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# DELETE /logs/{id}/entries/{entry_id}
# ---------------------------------------------------------------------------


@router.delete("/{log_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    log_id: int,
    entry_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Remove a single MealLogEntry; the parent MealLog row remains."""
    meal_log = await _get_meal_log_or_404(log_id, current_user, session)
    entry = await _get_entry_or_404(meal_log, entry_id, session)
    await session.delete(entry)
    await session.commit()
