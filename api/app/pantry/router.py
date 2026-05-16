"""Pantry endpoints: list, create, update, delete, expiring."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.pantry import PantryItem, StorageLocation
from app.models.user import User
from app.schemas.pantry import PantryItemCreate, PantryItemResponse, PantryItemUpdate

router = APIRouter(prefix="/pantry", tags=["pantry"])


def _sorted_items(items: list[PantryItem]) -> list[PantryItem]:
    """Sort pantry items: expiry_date ASC (nulls last), then created_at DESC."""
    with_expiry = sorted(
        [i for i in items if i.expiry_date is not None],
        key=lambda i: i.expiry_date,  # type: ignore[return-value]
    )
    without_expiry = sorted(
        [i for i in items if i.expiry_date is None],
        key=lambda i: i.created_at,
        reverse=True,
    )
    return with_expiry + without_expiry


# ---------------------------------------------------------------------------
# GET /pantry — list all pantry items (with optional location filter)
# ---------------------------------------------------------------------------


@router.get("", response_model=list[PantryItemResponse])
async def list_pantry_items(
    location: StorageLocation | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[PantryItem]:
    """List all pantry items for the current user.

    Optionally filter by storage location with ``?location=<value>``.
    Results are sorted: expiry_date ASC (nulls last), then created_at DESC.
    """
    filters = [PantryItem.user_id == current_user.id]
    if location is not None:
        filters.append(PantryItem.storage_location == location)

    stmt = select(PantryItem).where(and_(*filters))
    result = await session.execute(stmt)
    items = list(result.scalars().all())
    return _sorted_items(items)


# ---------------------------------------------------------------------------
# GET /pantry/expiring — items expiring within N days
# ---------------------------------------------------------------------------


@router.get("/expiring", response_model=list[PantryItemResponse])
async def list_expiring_pantry_items(
    days: int = Query(default=3, ge=0),
    location: StorageLocation | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[PantryItem]:
    """Return items expiring within ``days`` days (inclusive of today).

    Optionally filter by ``?location=<value>``.
    """
    cutoff = date.today() + timedelta(days=days)
    filters = [
        PantryItem.user_id == current_user.id,
        PantryItem.expiry_date.is_not(None),
        PantryItem.expiry_date <= cutoff,
    ]
    if location is not None:
        filters.append(PantryItem.storage_location == location)

    stmt = select(PantryItem).where(and_(*filters))
    result = await session.execute(stmt)
    items = list(result.scalars().all())
    return _sorted_items(items)


# ---------------------------------------------------------------------------
# POST /pantry — create pantry item
# ---------------------------------------------------------------------------


@router.post("", response_model=PantryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_pantry_item(
    body: PantryItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PantryItem:
    """Create a new pantry item for the current user."""
    item = PantryItem(**body.model_dump(), user_id=current_user.id)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


# ---------------------------------------------------------------------------
# PATCH /pantry/{id} — update pantry item
# ---------------------------------------------------------------------------


@router.patch("/{item_id}", response_model=PantryItemResponse)
async def update_pantry_item(
    item_id: int,
    body: PantryItemUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PantryItem:
    """Update a pantry item owned by the current user."""
    result = await session.execute(select(PantryItem).where(PantryItem.id == item_id))
    item = result.scalar_one_or_none()

    if item is None or item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pantry item not found"
        )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    await session.commit()
    await session.refresh(item)
    return item


# ---------------------------------------------------------------------------
# DELETE /pantry/{id} — delete pantry item
# ---------------------------------------------------------------------------


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pantry_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a pantry item owned by the current user."""
    result = await session.execute(select(PantryItem).where(PantryItem.id == item_id))
    item = result.scalar_one_or_none()

    if item is None or item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pantry item not found"
        )

    await session.delete(item)
    await session.commit()
