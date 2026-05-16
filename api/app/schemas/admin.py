"""Pydantic schemas for admin endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.user import UserRole

# ── Promotion endpoints ───────────────────────────────────────────────────────


class PromotionRejectRequest(BaseModel):
    rejection_note: str = Field(min_length=1, max_length=1000)


# ── Bulk import ───────────────────────────────────────────────────────────────


class BulkIngredientItem(BaseModel):
    """Schema for a single item in the bulk import payload."""

    name: str = Field(min_length=1, max_length=255)
    unit: str  # validated against UnitType in the endpoint
    portion_size: float = Field(default=100.0, gt=0)
    kcal: float = Field(ge=0)
    protein: float = Field(ge=0)
    fat: float = Field(ge=0)
    carbohydrates: float = Field(ge=0)
    fiber: float = Field(ge=0)
    sodium: float = Field(ge=0)
    icon: str | None = Field(default=None, max_length=10)


class BulkImportResponse(BaseModel):
    inserted: int
    updated: int


# ── User management ───────────────────────────────────────────────────────────


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserActivationUpdate(BaseModel):
    is_active: bool


class UserRoleUpdate(BaseModel):
    role: UserRole
