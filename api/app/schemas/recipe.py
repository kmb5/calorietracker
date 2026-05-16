from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.ingredient import IngredientDetail

# ── Ingredient item in recipe ────────────────────────────────────────────────


class RecipeIngredientItem(BaseModel):
    """Embedded ingredient row inside a recipe response."""

    id: int
    ingredient_id: int
    amount: float
    display_order: int
    ingredient: IngredientDetail

    model_config = {"from_attributes": True}


class RecipeIngredientInput(BaseModel):
    """Ingredient row submitted by the client when creating/updating a recipe."""

    ingredient_id: int
    amount: float = Field(gt=0)
    display_order: int = Field(ge=0, default=0)


# ── Recipe responses ─────────────────────────────────────────────────────────


class RecipeSummary(BaseModel):
    """Light summary returned in list views."""

    id: int
    name: str
    description: str | None
    last_cooked_at: datetime | None
    last_cooked_weight_g: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecipeDetail(BaseModel):
    """Full recipe with ingredient list, returned by GET /recipes/{id}."""

    id: int
    owner_id: int
    name: str
    description: str | None
    last_cooked_at: datetime | None
    last_cooked_weight_g: float | None
    created_at: datetime
    updated_at: datetime
    ingredients: list[RecipeIngredientItem]

    model_config = {"from_attributes": True}


# ── Write schemas ─────────────────────────────────────────────────────────────


class RecipeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    ingredients: list[RecipeIngredientInput] = Field(default_factory=list)


class RecipeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    ingredients: list[RecipeIngredientInput] | None = None


class RecipeDuplicateResponse(BaseModel):
    id: int


# ── Cooking mode schemas ──────────────────────────────────────────────────────


class MacroValues(BaseModel):
    kcal: float
    protein: float
    fat: float
    carbohydrates: float
    fiber: float
    sodium: float


class NutritionResult(BaseModel):
    totals: MacroValues
    per_100g: MacroValues


class RecipeIngredientIn(BaseModel):
    """Ingredient amount submitted for a cooking session."""

    ingredient_id: int
    amount: float = Field(gt=0)


class CookRequest(BaseModel):
    ingredient_amounts: list[RecipeIngredientIn]
    extra_kcal: float = Field(default=0.0, ge=0.0)
    cooked_weight_g: float = Field(gt=0)
