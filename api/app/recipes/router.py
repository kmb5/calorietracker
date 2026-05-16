"""Recipe CRUD endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user import User
from app.nutrition import IngredientNutrition, calculate_nutrition
from app.schemas.recipe import (
    CookRequest,
    MacroValues,
    NutritionResult,
    RecipeCreate,
    RecipeDetail,
    RecipeDuplicateResponse,
    RecipeSummary,
    RecipeUpdate,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _load_recipe_with_ingredients(
    recipe_id: int, session: AsyncSession
) -> Recipe:
    """Load recipe with full ingredient details (for response serialisation)."""
    result = await session.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
        )
    )
    return result.scalar_one()


async def _validate_ingredients(
    ingredient_ids: list[int], owner: User, session: AsyncSession
) -> None:
    """
    Ensure every ingredient_id exists and is accessible to the owner.
    Private ingredients owned by another user → HTTP 400.
    """
    if not ingredient_ids:
        return
    result = await session.execute(
        select(Ingredient).where(Ingredient.id.in_(ingredient_ids))
    )
    found = {ing.id: ing for ing in result.scalars().all()}

    for ing_id in ingredient_ids:
        ingredient = found.get(ing_id)
        if ingredient is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ingredient {ing_id} not found",
            )
        # Private ingredient belonging to another user
        if not ingredient.is_system and ingredient.owner_id != owner.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ingredient {ing_id} is private and cannot be embedded",
            )


# ---------------------------------------------------------------------------
# GET /recipes
# ---------------------------------------------------------------------------


@router.get("", response_model=list[RecipeSummary])
async def list_recipes(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[Recipe]:
    """Return the current user's recipes, sorted by last_cooked_at DESC (nulls last, then by name)."""
    result = await session.execute(
        select(Recipe).where(Recipe.owner_id == current_user.id)
    )
    recipes = list(result.scalars().all())

    # Sort: cooked first (desc), never-cooked at end sorted by name
    recipes.sort(
        key=lambda r: (
            r.last_cooked_at is None,
            -(r.last_cooked_at.timestamp() if r.last_cooked_at else 0),
            r.name.lower(),
        )
    )
    return recipes


# ---------------------------------------------------------------------------
# POST /recipes
# ---------------------------------------------------------------------------


@router.post("", response_model=RecipeDetail, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    body: RecipeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Recipe:
    ingredient_ids = [item.ingredient_id for item in body.ingredients]
    await _validate_ingredients(ingredient_ids, current_user, session)

    recipe = Recipe(
        owner_id=current_user.id,
        name=body.name,
        description=body.description,
    )
    session.add(recipe)
    await session.flush()  # get recipe.id

    for item in body.ingredients:
        ri = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=item.ingredient_id,
            amount=item.amount,
            display_order=item.display_order,
        )
        session.add(ri)

    await session.commit()
    return await _load_recipe_with_ingredients(recipe.id, session)


# ---------------------------------------------------------------------------
# GET /recipes/{id}
# ---------------------------------------------------------------------------


@router.get("/{recipe_id}", response_model=RecipeDetail)
async def get_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Recipe:
    result = await session.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
        )
    )
    recipe = result.scalar_one_or_none()
    if recipe is None or recipe.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found"
        )
    return recipe


# ---------------------------------------------------------------------------
# PATCH /recipes/{id}
# ---------------------------------------------------------------------------


@router.patch("/{recipe_id}", response_model=RecipeDetail)
async def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Recipe:
    # Load recipe (no eager ingredient loading needed here)
    result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None or recipe.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found"
        )

    if body.name is not None:
        recipe.name = body.name
    if "description" in body.model_fields_set:
        recipe.description = body.description

    if body.ingredients is not None:
        ingredient_ids = [item.ingredient_id for item in body.ingredients]
        await _validate_ingredients(ingredient_ids, current_user, session)

        # Delete existing recipe_ingredients
        existing = await session.execute(
            select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe_id)
        )
        for ri in existing.scalars().all():
            await session.delete(ri)
        await session.flush()

        # Reinsert
        for item in body.ingredients:
            ri = RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=item.ingredient_id,
                amount=item.amount,
                display_order=item.display_order,
            )
            session.add(ri)

    await session.commit()
    return await _load_recipe_with_ingredients(recipe.id, session)


# ---------------------------------------------------------------------------
# DELETE /recipes/{id}
# ---------------------------------------------------------------------------


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None or recipe.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found"
        )

    await session.delete(recipe)
    await session.commit()


# ---------------------------------------------------------------------------
# POST /recipes/{id}/duplicate
# ---------------------------------------------------------------------------


@router.post(
    "/{recipe_id}/duplicate",
    response_model=RecipeDuplicateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    result = await session.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(selectinload(Recipe.ingredients))
    )
    recipe = result.scalar_one_or_none()
    if recipe is None or recipe.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found"
        )

    new_recipe = Recipe(
        owner_id=current_user.id,
        name=f"Copy of {recipe.name}",
        description=recipe.description,
    )
    session.add(new_recipe)
    await session.flush()

    for ri in recipe.ingredients:
        new_ri = RecipeIngredient(
            recipe_id=new_recipe.id,
            ingredient_id=ri.ingredient_id,
            amount=ri.amount,
            display_order=ri.display_order,
        )
        session.add(new_ri)

    await session.commit()
    return {"id": new_recipe.id}


# ---------------------------------------------------------------------------
# Shared cooking logic
# ---------------------------------------------------------------------------


async def _build_nutrition_result(
    body: CookRequest,
    current_user: User,
    session: AsyncSession,
) -> NutritionResult:
    """Resolve ingredient_amounts against the DB and call calculate_nutrition.

    Only ingredients that are system-wide OR owned by current_user are
    accessible — prevents leaking another user's private ingredient data.
    """
    ingredient_ids = [item.ingredient_id for item in body.ingredient_amounts]
    result = await session.execute(
        select(Ingredient).where(
            Ingredient.id.in_(ingredient_ids),
            (Ingredient.is_system == True) | (Ingredient.owner_id == current_user.id),  # noqa: E712
        )
    )
    ingredients_by_id: dict[int, Ingredient] = {
        ing.id: ing for ing in result.scalars().all()
    }

    pairs: list[tuple[IngredientNutrition, float]] = []
    for item in body.ingredient_amounts:
        ing = ingredients_by_id.get(item.ingredient_id)
        if ing is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Ingredient {item.ingredient_id} not found or not accessible",
            )
        pairs.append(
            (
                IngredientNutrition(
                    portion_size=ing.portion_size,
                    kcal=ing.kcal,
                    protein=ing.protein,
                    fat=ing.fat,
                    carbohydrates=ing.carbohydrates,
                    fiber=ing.fiber,
                    sodium=ing.sodium,
                ),
                item.amount,
            )
        )

    calc = calculate_nutrition(pairs, body.extra_kcal, body.cooked_weight_g)
    return NutritionResult(
        totals=MacroValues(
            kcal=calc.totals.kcal,
            protein=calc.totals.protein,
            fat=calc.totals.fat,
            carbohydrates=calc.totals.carbohydrates,
            fiber=calc.totals.fiber,
            sodium=calc.totals.sodium,
        ),
        per_100g=MacroValues(
            kcal=calc.per_100g.kcal,
            protein=calc.per_100g.protein,
            fat=calc.per_100g.fat,
            carbohydrates=calc.per_100g.carbohydrates,
            fiber=calc.per_100g.fiber,
            sodium=calc.per_100g.sodium,
        ),
    )


# ---------------------------------------------------------------------------
# POST /recipes/{id}/calculate
# ---------------------------------------------------------------------------


@router.post("/{recipe_id}/calculate", response_model=NutritionResult)
async def calculate_recipe(
    recipe_id: int,
    body: CookRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> NutritionResult:
    """Stateless nutrition calculation — does NOT write to the DB."""
    # Verify recipe ownership (404 for other user's recipes)
    result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None or recipe.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found"
        )
    return await _build_nutrition_result(body, current_user, session)


# ---------------------------------------------------------------------------
# POST /recipes/{id}/cook
# ---------------------------------------------------------------------------


@router.post("/{recipe_id}/cook", response_model=NutritionResult)
async def cook_recipe(
    recipe_id: int,
    body: CookRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> NutritionResult:
    """Calculate nutrition AND persist last_cooked_at + last_cooked_weight_g."""
    result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None or recipe.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found"
        )

    nutrition = await _build_nutrition_result(body, current_user, session)

    # Persist cook metadata
    recipe.last_cooked_at = datetime.now(tz=UTC)
    recipe.last_cooked_weight_g = body.cooked_weight_g
    await session.commit()

    return nutrition
