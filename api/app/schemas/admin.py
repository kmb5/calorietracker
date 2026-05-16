"""Pydantic schemas for admin-only endpoints."""

from pydantic import BaseModel, Field

from app.models.ingredient import UnitType
from app.models.user import UserRole
from app.schemas.ingredient import (  # noqa: F401 — re-exported
    IngredientCreate,
    IngredientDetail,
)

# ---------------------------------------------------------------------------
# Promotion management
# ---------------------------------------------------------------------------


class PromotionRejectRequest(BaseModel):
    rejection_note: str = Field(min_length=1, max_length=1000)


# ---------------------------------------------------------------------------
# System ingredient creation (same fields as user create)
# ---------------------------------------------------------------------------

# IngredientCreate is reused — the router forces is_system=True / owner_id=None.


# ---------------------------------------------------------------------------
# Bulk import
# ---------------------------------------------------------------------------


class BulkImportItem(BaseModel):
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


class BulkImportResult(BaseModel):
    created: int
    updated: int
    total: int


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


class UserAdminResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class UserActivateRequest(BaseModel):
    is_active: bool


class UserRoleRequest(BaseModel):
    role: UserRole
