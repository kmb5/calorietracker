from pydantic import BaseModel, Field

from app.models.ingredient import UnitType

# ── Search result (summary) ───────────────────────────────────────────────────


class IngredientSearchResult(BaseModel):
    id: int
    name: str
    unit: UnitType
    portion_size: float
    kcal: float
    is_system: bool
    icon: str | None

    model_config = {"from_attributes": True}


# ── Full detail ───────────────────────────────────────────────────────────────


class IngredientDetail(BaseModel):
    id: int
    name: str
    unit: UnitType
    portion_size: float
    kcal: float
    protein: float
    fat: float
    carbohydrates: float
    fiber: float
    sodium: float
    is_system: bool
    owner_id: int | None
    icon: str | None
    is_promotion_pending: bool

    model_config = {"from_attributes": True}


# ── Write schemas ─────────────────────────────────────────────────────────────


class IngredientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    unit: UnitType
    portion_size: float = Field(default=100.0, gt=0)
    kcal: float = Field(ge=0)
    protein: float = Field(ge=0)
    fat: float = Field(ge=0)
    carbohydrates: float = Field(ge=0)
    fiber: float = Field(ge=0)
    sodium: float = Field(ge=0)
    icon: str | None = Field(default=None, max_length=10)


class IngredientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    unit: UnitType | None = None
    portion_size: float | None = Field(default=None, gt=0)
    kcal: float | None = Field(default=None, ge=0)
    protein: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    carbohydrates: float | None = Field(default=None, ge=0)
    fiber: float | None = Field(default=None, ge=0)
    sodium: float | None = Field(default=None, ge=0)
    icon: str | None = Field(default=None, max_length=10)
