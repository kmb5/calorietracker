"""Pantry router — CRUD + expiring endpoint."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, asc, case, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.pantry import PantryItem
from app.models.user import User
from app.schemas.pantry import PantryItemCreate, PantryItemResponse, PantryItemUpdate

router = APIRouter(prefix="/pantry", tags=["pantry"])


def _sort_expr():
    """Return ORDER BY clause: dated items ASC by expiry, undated by created_at DESC."""
    return (
        # NULL expiry_date sorts after non-NULL (0 = has date, 1 = no date)
        case((PantryItem.expiry_date.is_(None), 1), else_=0),
        asc(PantryItem.expiry_date),
        desc(PantryItem.created_at),
    )


@router.get("/expiring", response_model=list[PantryItemResponse])
async def get_expiring_items(
    days: int = Query(3, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[PantryItemResponse]:
    """Return items with expiry_date within the next N days (inclusive of today)."""
    today = date.today()
    cutoff = today + timedelta(days=days)
    stmt = (
        select(PantryItem)
        .where(
            and_(
                PantryItem.user_id == current_user.id,
                PantryItem.expiry_date.is_not(None),
                PantryItem.expiry_date <= cutoff,
            )
        )
        .order_by(*_sort_expr())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.get("", response_model=list[PantryItemResponse])
async def list_pantry_items(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[PantryItemResponse]:
    """List all pantry items for the current user with the default sort order."""
    stmt = (
        select(PantryItem)
        .where(PantryItem.user_id == current_user.id)
        .order_by(*_sort_expr())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=PantryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_pantry_item(
    body: PantryItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PantryItemResponse:
    item = PantryItem(
        user_id=current_user.id,
        name=body.name,
        ingredient_id=body.ingredient_id,
        quantity=body.quantity,
        unit=body.unit,
        expiry_date=body.expiry_date,
        storage_location=body.storage_location,
        notes=body.notes,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item  # type: ignore[return-value]


@router.patch("/{item_id}", response_model=PantryItemResponse)
async def update_pantry_item(
    item_id: int,
    body: PantryItemUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PantryItemResponse:
    item = await _get_user_item(item_id, current_user.id, session)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    await session.commit()
    await session.refresh(item)
    return item  # type: ignore[return-value]


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pantry_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    item = await _get_user_item(item_id, current_user.id, session)
    await session.delete(item)
    await session.commit()


async def _get_user_item(
    item_id: int, user_id: int, session: AsyncSession
) -> PantryItem:
    result = await session.execute(
        select(PantryItem).where(
            and_(PantryItem.id == item_id, PantryItem.user_id == user_id)
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return item
