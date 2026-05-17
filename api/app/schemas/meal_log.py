"""Pydantic schemas for the meal log feature."""

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.meal_log import MealType

# ── Entry-level schemas ───────────────────────────────────────────────────────


class MealLogEntryCreate(BaseModel):
    ingredient_id: int | None = None
    recipe_id: int | None = None
    amount_g: float = Field(gt=0)
    # Client provides snapshotted nutrition values
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    carbohydrates_g: float = Field(ge=0)
    fiber_g: float = Field(ge=0)
    sodium_mg: float = Field(ge=0)


class MealLogEntryRead(BaseModel):
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


# ── Log-level schemas ─────────────────────────────────────────────────────────


class MealLogCreate(BaseModel):
    logged_date: date
    meal_type: MealType
    name: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)
    entries: list[MealLogEntryCreate] = Field(min_length=1)


class MealLogRead(BaseModel):
    id: int
    user_id: int
    logged_date: date
    meal_type: MealType
    name: str | None
    notes: str | None
    created_at: datetime
    entries: list[MealLogEntryRead]

    model_config = {"from_attributes": True}


# ── Summary schema ────────────────────────────────────────────────────────────


class DailySummary(BaseModel):
    logged_date: date
    kcal: float
    protein_g: float
    fat_g: float
    carbohydrates_g: float
    fiber_g: float
    sodium_mg: float
