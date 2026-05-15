from pydantic import BaseModel

from app.models.ingredient import UnitType

# ── Search result (summary) ───────────────────────────────────────────────────


class IngredientSearchResult(BaseModel):
    id: int
    name: str
    unit: UnitType
    portion_size: float
    kcal: float

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

    model_config = {"from_attributes": True}
