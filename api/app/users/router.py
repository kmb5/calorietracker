from fastapi import APIRouter, Depends
from sqlalchemy import select
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
    result = await session.execute(
        select(MacroTarget).where(MacroTarget.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = MacroTarget(user_id=current_user.id)
        session.add(row)

    row.kcal_target = body.kcal_target
    row.protein_g_target = body.protein_g_target
    row.fat_g_target = body.fat_g_target
    row.carbohydrates_g_target = body.carbohydrates_g_target
    row.fiber_g_target = body.fiber_g_target
    row.sodium_mg_target = body.sodium_mg_target

    await session.commit()
    await session.refresh(row)
    return MacroTargetResponse.model_validate(row)
