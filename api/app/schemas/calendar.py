"""Schemas for calendar aggregation endpoints."""

from datetime import date

from pydantic import BaseModel, Field


class DaySummary(BaseModel):
    """Aggregated nutrition totals for a single calendar day."""

    date: date
    total_kcal: float = Field(ge=0)
    total_protein_g: float = Field(ge=0)
    total_fat_g: float = Field(ge=0)
    total_carbs_g: float = Field(ge=0)
    entry_count: int = Field(ge=0)
