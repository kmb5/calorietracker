from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import MacroTarget, User
from app.schemas.macro_target import MacroTargetResponse, MacroTargetUpdate

router = APIRouter(prefix="/users/me", tags=["users"])


@router.get("/targets", response_model=MacroTargetResponse)
async def get_targets(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MacroTargetResponse:
    result = await session.execute(
        select(MacroTarget).where(MacroTarget.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return MacroTargetResponse()
    return MacroTargetResponse.model_validate(row)


@router.put("/targets", response_model=MacroTargetResponse)
async def put_targets(
    body: MacroTargetUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MacroTargetResponse:
    update_fields = {
        "kcal_target": body.kcal_target,
        "protein_g_target": body.protein_g_target,
        "fat_g_target": body.fat_g_target,
        "carbohydrates_g_target": body.carbohydrates_g_target,
        "fiber_g_target": body.fiber_g_target,
        "sodium_mg_target": body.sodium_mg_target,
    }

    result = await session.execute(
        select(MacroTarget).where(MacroTarget.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = MacroTarget(user_id=current_user.id, **update_fields)
        session.add(row)
        try:
            # flush so the INSERT hits the DB while still inside the transaction;
            # this lets us catch a UniqueConstraintViolation from a concurrent
            # request (double-tap) without committing a partial state.
            await session.flush()
        except IntegrityError:
            # A concurrent PUT snuck in between our SELECT and INSERT.
            # Roll back, re-fetch the now-existing row, and update it instead.
            await session.rollback()
            result = await session.execute(
                select(MacroTarget).where(MacroTarget.user_id == current_user.id)
            )
            row = result.scalar_one()
            for key, value in update_fields.items():
                setattr(row, key, value)
    else:
        for key, value in update_fields.items():
            setattr(row, key, value)

    await session.commit()
    await session.refresh(row)
    return MacroTargetResponse.model_validate(row)
