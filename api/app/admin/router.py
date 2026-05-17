"""Admin-only API endpoints.

All routes in this module require ``role=admin``; the ``get_current_admin``
dependency returns HTTP 403 for non-admin callers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models.ingredient import Ingredient
from app.models.user import User
from app.schemas.admin import (
    BulkImportItem,
    BulkImportResult,
    PromotionRejectRequest,
    UserActivateRequest,
    UserAdminResponse,
    UserRoleRequest,
)
from app.schemas.ingredient import IngredientCreate, IngredientDetail, IngredientUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


# ===========================================================================
# Ingredient promotion management
# ===========================================================================


@router.get("/ingredients/promotions", response_model=list[IngredientDetail])
async def list_promotions(
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> list[Ingredient]:
    """Return all ingredients with ``is_promotion_pending=True``."""
    result = await session.execute(
        select(Ingredient).where(Ingredient.is_promotion_pending.is_(True))
    )
    return list(result.scalars().all())


@router.post(
    "/ingredients/promotions/{ingredient_id}/approve",
    response_model=IngredientDetail,
)
async def approve_promotion(
    ingredient_id: int,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Approve a promotion request.

    Sets ``is_system=True``, ``owner_id=None``, ``is_promotion_pending=False``.
    The ingredient becomes visible to all users.
    """
    ingredient = await _get_pending_ingredient(ingredient_id, session)

    ingredient.is_system = True
    ingredient.owner_id = None
    ingredient.is_promotion_pending = False
    ingredient.promotion_rejection_note = None

    await session.commit()
    await session.refresh(ingredient)
    return ingredient


@router.post(
    "/ingredients/promotions/{ingredient_id}/reject",
    response_model=IngredientDetail,
)
async def reject_promotion(
    ingredient_id: int,
    body: PromotionRejectRequest,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Reject a promotion request, storing the reason on the ingredient row."""
    ingredient = await _get_pending_ingredient(ingredient_id, session)

    ingredient.is_promotion_pending = False
    ingredient.promotion_rejection_note = body.rejection_note

    await session.commit()
    await session.refresh(ingredient)
    return ingredient


async def _get_pending_ingredient(
    ingredient_id: int, session: AsyncSession
) -> Ingredient:
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )
    if not ingredient.is_promotion_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingredient does not have a pending promotion",
        )
    return ingredient


# ===========================================================================
# System ingredient CRUD
# ===========================================================================


@router.get("/ingredients", response_model=list[IngredientDetail])
async def list_system_ingredients(
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> list[Ingredient]:
    """Return all system ingredients with full nutrition detail."""
    result = await session.execute(
        select(Ingredient)
        .where(Ingredient.is_system.is_(True))
        .order_by(Ingredient.name)
    )
    return list(result.scalars().all())


@router.get("/ingredients/{ingredient_id}", response_model=IngredientDetail)
async def get_any_ingredient(
    ingredient_id: int,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Return full detail for any ingredient by ID (admin-only)."""
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )
    return ingredient


@router.post(
    "/ingredients",
    response_model=IngredientDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_system_ingredient(
    body: IngredientCreate,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Create a new system ingredient (``is_system=True``, ``owner_id=None``)."""
    ingredient = Ingredient(
        **body.model_dump(),
        is_system=True,
        owner_id=None,
    )
    session.add(ingredient)
    await session.commit()
    await session.refresh(ingredient)
    return ingredient


@router.patch("/ingredients/{ingredient_id}", response_model=IngredientDetail)
async def update_any_ingredient(
    ingredient_id: int,
    body: IngredientUpdate,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Update any ingredient regardless of owner."""
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(ingredient, field, value)

    await session.commit()
    await session.refresh(ingredient)
    return ingredient


@router.delete("/ingredients/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_any_ingredient(
    ingredient_id: int,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete any ingredient.

    Returns HTTP 409 if the ingredient is referenced by any RecipeIngredient
    or MealLogEntry row (those tables are added in later PRDs; the guard is
    wired in once the models exist).
    """
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    await _check_ingredient_not_referenced(ingredient_id, session)

    await session.delete(ingredient)
    await session.commit()


async def _check_ingredient_not_referenced(
    ingredient_id: int, session: AsyncSession
) -> None:
    """Raise HTTP 409 if the ingredient is referenced by any recipe or meal log row.

    Uses SAVEPOINTs so that an OperationalError from a not-yet-existing table
    (added in later issues) is scoped and rolled back without aborting the
    outer transaction.
    """
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    for table, detail in [
        (
            "recipe_ingredients",
            "Ingredient is referenced by one or more recipes",
        ),
        (
            "meal_log_entries",
            "Ingredient is referenced by one or more meal log entries",
        ),
    ]:
        try:
            async with session.begin_nested():  # SAVEPOINT
                result = await session.execute(
                    text(f"SELECT COUNT(*) FROM {table} WHERE ingredient_id = :id"),
                    {"id": ingredient_id},
                )
                if (result.scalar() or 0) > 0:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=detail,
                    )
        except OperationalError:
            # Table does not exist yet — savepoint rolled back, outer tx intact.
            pass


# ===========================================================================
# Bulk import
# ===========================================================================


@router.post(
    "/ingredients/bulk-import",
    response_model=BulkImportResult,
    status_code=status.HTTP_200_OK,
)
async def bulk_import_ingredients(
    items: list[BulkImportItem],
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> BulkImportResult:
    """Idempotent upsert of system ingredients by (name, unit).

    Re-importing the same payload does not create duplicates.
    Only existing *system* ingredients are candidates for update;
    user-owned ingredients with the same (name, unit) are never touched.
    """
    if not items:
        return BulkImportResult(created=0, updated=0, total=0)

    # Single batched lookup — no N+1 queries.
    # We look up ALL ingredients for the given (name, unit) pairs so that:
    #   • Existing system ingredients are updated in-place.
    #   • User-owned ingredients with the same key are silently skipped —
    #     we must not strip their ownership, and the DB UNIQUE constraint
    #     would reject a duplicate insert anyway.
    names_units = [(item.name, item.unit) for item in items]
    existing_result = await session.execute(
        select(Ingredient).where(
            tuple_(Ingredient.name, Ingredient.unit).in_(names_units),
        )
    )
    existing_map: dict[tuple[str, str], Ingredient] = {
        (ing.name, ing.unit): ing for ing in existing_result.scalars()
    }

    created = 0
    updated = 0
    skipped = 0

    for item in items:
        existing = existing_map.get((item.name, item.unit))

        if existing is None:
            session.add(
                Ingredient(
                    **item.model_dump(),
                    is_system=True,
                    owner_id=None,
                )
            )
            created += 1
        elif existing.is_system:
            # Safe to update — this is already a system ingredient.
            for field, value in item.model_dump().items():
                setattr(existing, field, value)
            existing.is_system = True
            existing.owner_id = None
            updated += 1
        else:
            # A user-owned ingredient holds this (name, unit) key.
            # Skip silently — never strip ownership.
            skipped += 1

    await session.commit()
    return BulkImportResult(created=created, updated=updated, total=created + updated)


# ===========================================================================
# User management
# ===========================================================================


@router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> list[User]:
    """Return all registered users."""
    result = await session.execute(select(User))
    return list(result.scalars().all())


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user_active(
    user_id: int,
    body: UserActivateRequest,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Activate or deactivate a user account."""
    if user_id == _admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot modify their own account via this endpoint",
        )
    user = await _get_user_or_404(user_id, session)
    user.is_active = body.is_active
    await session.commit()
    await session.refresh(user)
    return user


@router.patch("/users/{user_id}/role", response_model=UserAdminResponse)
async def update_user_role(
    user_id: int,
    body: UserRoleRequest,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Set a user's role (``user`` or ``admin``)."""
    if user_id == _admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot modify their own account via this endpoint",
        )
    user = await _get_user_or_404(user_id, session)
    user.role = body.role
    await session.commit()
    await session.refresh(user)
    return user


async def _get_user_or_404(user_id: int, session: AsyncSession) -> User:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user
