from pydantic import BaseModel


class MacroTargetResponse(BaseModel):
    kcal_target: float | None = None
    protein_g_target: float | None = None
    fat_g_target: float | None = None
    carbohydrates_g_target: float | None = None
    fiber_g_target: float | None = None
    sodium_mg_target: float | None = None

    model_config = {"from_attributes": True}


class MacroTargetUpdate(BaseModel):
    kcal_target: float | None = None
    protein_g_target: float | None = None
    fat_g_target: float | None = None
    carbohydrates_g_target: float | None = None
    fiber_g_target: float | None = None
    sodium_mg_target: float | None = None
