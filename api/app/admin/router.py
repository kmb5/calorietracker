"""Admin-only endpoints.

All routes in this router require ``role=admin``.
Non-admin callers receive HTTP 403 via the ``get_current_admin`` dependency.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models.ingredient import Ingredient, UnitType
from app.models.user import User
from app.schemas.admin import (
    BulkImportResponse,
    BulkIngredientItem,
    PromotionRejectRequest,
    UserActivationUpdate,
    UserResponse,
    UserRoleUpdate,
)
from app.schemas.ingredient import IngredientCreate, IngredientDetail, IngredientUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Promotion management
# ---------------------------------------------------------------------------


@router.get("/ingredients/promotions", response_model=list[IngredientDetail])
async def list_pending_promotions(
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
    """Reject a promotion request, storing the rejection note."""
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

    ingredient.is_promotion_pending = False
    ingredient.promotion_rejection_note = body.rejection_note
    await session.commit()
    await session.refresh(ingredient)
    return ingredient


# ---------------------------------------------------------------------------
# System ingredient CRUD
# ---------------------------------------------------------------------------


@router.post(
    "/ingredients",
    response_model=IngredientDetail,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_ingredient(
    body: IngredientCreate,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> Ingredient:
    """Create a system ingredient directly (``is_system=True``, ``owner_id=None``)."""
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
async def admin_update_ingredient(
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
async def admin_delete_ingredient(
    ingredient_id: int,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete any ingredient.

    Returns HTTP 409 if the ingredient is referenced by any RecipeIngredient
    or MealLogEntry row (those models are added in later issues; this guard
    will be wired up when they exist).
    """
    result = await session.execute(
        select(Ingredient).where(Ingredient.id == ingredient_id)
    )
    ingredient = result.scalar_one_or_none()
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found"
        )

    # Guard: refuse if referenced by recipe ingredients or meal log entries.
    # The RecipeIngredient and MealLogEntry models are added in later issues.
    # We check for their tables dynamically to avoid hard imports on
    # not-yet-created models.
    await _check_ingredient_not_referenced(ingredient_id, session)

    await session.delete(ingredient)
    await session.commit()


async def _check_ingredient_not_referenced(
    ingredient_id: int, session: AsyncSession
) -> None:
    """Raise HTTP 409 if the ingredient is in use by any recipe or log row."""
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    # Check recipe_ingredients table (added in a later issue)
    try:
        async with session.begin_nested():  # SAVEPOINT — scopes any rollback here
            count_result = await session.execute(
                text(
                    "SELECT COUNT(*) FROM recipe_ingredients WHERE ingredient_id = :id"
                ),
                {"id": ingredient_id},
            )
            if (count_result.scalar() or 0) > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ingredient is referenced by one or more recipes",
                )
    except OperationalError:
        # Table does not exist yet; savepoint rolled back, outer transaction intact
        pass

    # Check meal_log_entries table (added in a later issue)
    try:
        async with session.begin_nested():  # SAVEPOINT — scopes any rollback here
            count_result = await session.execute(
                text("SELECT COUNT(*) FROM meal_log_entries WHERE ingredient_id = :id"),
                {"id": ingredient_id},
            )
            if (count_result.scalar() or 0) > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ingredient is referenced by one or more meal log entries",
                )
    except OperationalError:
        # Table does not exist yet; savepoint rolled back, outer transaction intact
        pass


# ---------------------------------------------------------------------------
# Bulk import
# ---------------------------------------------------------------------------


@router.post(
    "/ingredients/bulk-import",
    response_model=BulkImportResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_import_ingredients(
    items: list[BulkIngredientItem],
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> BulkImportResponse:
    """Idempotent upsert of ingredients by (name, unit).

    If an ingredient with the same normalised (lowercased+stripped) name and
    unit already exists it is updated; otherwise a new system ingredient is
    created.
    """
    inserted = 0
    updated = 0

    for item in items:
        # Validate unit
        try:
            unit = UnitType(item.unit)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid unit '{item.unit}'",
            )

        normalised_name = item.name.strip().lower()

        result = await session.execute(
            select(Ingredient).where(
                func.lower(func.trim(Ingredient.name)) == normalised_name,
                Ingredient.unit == unit,
            )
        )
        existing = result.scalar_one_or_none()

        if existing is not None:
            existing.portion_size = item.portion_size
            existing.kcal = item.kcal
            existing.protein = item.protein
            existing.fat = item.fat
            existing.carbohydrates = item.carbohydrates
            existing.fiber = item.fiber
            existing.sodium = item.sodium
            if item.icon is not None:
                existing.icon = item.icon
            updated += 1
        else:
            new_ing = Ingredient(
                name=item.name.strip(),
                unit=unit,
                portion_size=item.portion_size,
                kcal=item.kcal,
                protein=item.protein,
                fat=item.fat,
                carbohydrates=item.carbohydrates,
                fiber=item.fiber,
                sodium=item.sodium,
                icon=item.icon,
                is_system=True,
                owner_id=None,
            )
            session.add(new_ing)
            inserted += 1

    await session.commit()
    return BulkImportResponse(inserted=inserted, updated=updated)


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> list[User]:
    """Return all registered users."""
    result = await session.execute(select(User).order_by(User.id))
    return list(result.scalars().all())


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user_activation(
    user_id: int,
    body: UserActivationUpdate,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Activate or deactivate a user account."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    user.is_active = body.is_active
    await session.commit()
    await session.refresh(user)
    return user


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    body: UserRoleUpdate,
    _admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Set a user's role (``user`` or ``admin``)."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    user.role = body.role
    await session.commit()
    await session.refresh(user)
    return user
