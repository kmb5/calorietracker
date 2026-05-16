from datetime import date

from pydantic import BaseModel, Field

from app.models.pantry import StorageLocation


class PantryItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    ingredient_id: int | None = None
    quantity: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1, max_length=50)
    expiry_date: date | None = None
    storage_location: StorageLocation = StorageLocation.pantry
    notes: str | None = Field(None, max_length=500)


class PantryItemUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    ingredient_id: int | None = None
    quantity: float | None = Field(None, gt=0)
    unit: str | None = Field(None, min_length=1, max_length=50)
    expiry_date: date | None = None
    storage_location: StorageLocation | None = None
    notes: str | None = Field(None, max_length=500)


class PantryItemResponse(BaseModel):
    id: int
    user_id: int
    name: str
    ingredient_id: int | None
    quantity: float
    unit: str
    expiry_date: date | None
    storage_location: StorageLocation
    notes: str | None

    model_config = {"from_attributes": True}
