"""Pydantic schemas for MealLog and MealLogEntry endpoints."""

from datetime import date

from pydantic import BaseModel, Field

from app.models.meal_log import MealType

# ---------------------------------------------------------------------------
# MealLogEntry schemas
# ---------------------------------------------------------------------------


class MealLogEntryCreate(BaseModel):
    ingredient_id: int | None = None
    recipe_id: int | None = None
    amount_g: float = Field(gt=0)
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    carbohydrates_g: float = Field(ge=0)
    fiber_g: float = Field(ge=0)
    sodium_mg: float = Field(ge=0)


class MealLogEntryUpdate(BaseModel):
    amount_g: float = Field(gt=0)


class MealLogEntryResponse(BaseModel):
    id: int
    meal_log_id: int
    ingredient_id: int | None
    recipe_id: int | None
    amount_g: float
    kcal: float
    protein_g: float
    fat_g: float
    carbohydrates_g: float
    fiber_g: float
    sodium_mg: float

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# MealLog schemas
# ---------------------------------------------------------------------------


class MealLogCreate(BaseModel):
    logged_date: date
    meal_type: MealType
    name: str | None = None
    notes: str | None = None
    entries: list[MealLogEntryCreate] = Field(default_factory=list)


class MealLogUpdate(BaseModel):
    meal_type: MealType | None = None
    notes: str | None = None


class MealLogResponse(BaseModel):
    id: int
    user_id: int
    logged_date: date
    meal_type: MealType
    name: str | None
    notes: str | None
    entries: list[MealLogEntryResponse]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Summary schema
# ---------------------------------------------------------------------------


class DailySummary(BaseModel):
    logged_date: date
    kcal: float
    protein_g: float
    fat_g: float
    carbohydrates_g: float
    fiber_g: float
    sodium_mg: float
