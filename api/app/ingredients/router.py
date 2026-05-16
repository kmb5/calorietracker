"""Ingredient endpoints: search, detail, create, update, delete, promote."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.ingredient import Ingredient, UnitType
from app.models.user import User, UserRole
from app.schemas.ingredient import (
    IngredientCreate,
    IngredientDetail,
    IngredientSearchResult,
    IngredientUpdate,
)

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


# ---------------------------------------------------------------------------
# GET /ingredients/search
# ---------------------------------------------------------------------------


@router.get("/search", response_model=list[IngredientSearchResult])
async def search_ingredients(
    q: str = Query(min_length=1),
    unit: UnitType | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[Ingredient]:
    """Search ingredients by name.

    Returns system ingredients + the calling user's own custom ingredients.
    Results are ordered: prefix matches first, then substring matches.
    """
    # Build the visibility filter: system OR owned by this user
    visibility = or_(
        Ingredient.is_system.is_(True), Ingredient.owner_id == current_user.id
    )

    # Build name filter — fetch all substring matches, then sort prefix-first in Python
    substring_filter = Ingredient.name.ilike(f"%{q}%")

    base_filters = [visibility, substring_filter]
    if unit is not None:
        base_filters.append(Ingredient.unit == unit)

    # No DB-level limit: fetch all matches first, sort prefix-first in Python,
    # then slice. Applying LIMIT before sorting would drop prefix matches that
    # happen to fall outside the first N rows returned by the DB.
    stmt = select(Ingredient).where(*base_filters)

    result = await session.execute(stmt)
    rows: list[Ingredient] = list(result.scalars().all())

    # Sort: prefix matches first, then substring matches (stable sort)
    prefix_lower = q.lower()
    rows.sort(key=lambda i: 0 if i.name.lower().startswith(prefix_lower) else 1)

    return rows[:limit]


# ---------------------------------------------------------------------------
# GET /ingredients/{id}
# ---------------------------------------------------------------------------


@router.get("/{ingredient_id}", response_model=IngredientDetail)
async def get_ingredient(
    ingredient_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Return full detail for a single ingredient.

    Returns 404 (not 403) if the ingredient belongs to another user,
    to avoid leaking the existence of private ingredients.
    """
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()

    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    # Hide another user's private ingredient — return 404 not 403
    if not ingredient.is_system and ingredient.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    return ingredient


# ---------------------------------------------------------------------------
# POST /ingredients — create custom ingredient
# ---------------------------------------------------------------------------


@router.post("", response_model=IngredientDetail, status_code=status.HTTP_201_CREATED)
async def create_ingredient(
    body: IngredientCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Create a custom ingredient owned by the calling user.

    ``is_system`` is always set to ``False``; ``owner_id`` is always the caller.
    """
    ingredient = Ingredient(
        **body.model_dump(),
        is_system=False,
        owner_id=current_user.id,
    )
    session.add(ingredient)
    await session.commit()
    await session.refresh(ingredient)
    return ingredient


# ---------------------------------------------------------------------------
# PATCH /ingredients/{id} — update own ingredient (admin: any)
# ---------------------------------------------------------------------------


@router.patch("/{ingredient_id}", response_model=IngredientDetail)
async def update_ingredient(
    ingredient_id: int,
    body: IngredientUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Update an ingredient.

    Regular users may only update ingredients they own.
    Admins may update any ingredient (system or custom).
    Returns 404 (not 403) for ownership violations.
    """
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()

    is_admin = current_user.role == UserRole.admin

    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    if not is_admin and ingredient.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(ingredient, field, value)

    await session.commit()
    await session.refresh(ingredient)
    return ingredient


# ---------------------------------------------------------------------------
# DELETE /ingredients/{id} — delete own ingredient (admin: any)
# ---------------------------------------------------------------------------


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingredient(
    ingredient_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete an ingredient.

    Regular users may only delete ingredients they own.
    Admins may delete any ingredient (system or custom).
    Returns 404 (not 403) for ownership violations.
    """
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()

    is_admin = current_user.role == UserRole.admin

    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    if not is_admin and ingredient.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    await session.delete(ingredient)
    await session.commit()


# ---------------------------------------------------------------------------
# POST /ingredients/{id}/promote — request promotion to system ingredient
# ---------------------------------------------------------------------------


@router.post("/{ingredient_id}/promote", response_model=IngredientDetail)
async def promote_ingredient(
    ingredient_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Set ``is_promotion_pending=True`` on a custom ingredient the caller owns.

    Idempotent — calling again when already pending is a no-op.
    Returns 404 (not 403) for ownership violations.
    """
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()

    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    if ingredient.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    if ingredient.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System ingredients cannot be promoted",
        )

    ingredient.is_promotion_pending = True
    await session.commit()
    await session.refresh(ingredient)
    return ingredient
