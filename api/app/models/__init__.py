# Re-export all models so that:
#   from app.models import User, RefreshToken, Ingredient  (callsite imports)
#   import app.models  (Alembic env.py — registers all models on Base.metadata)
# both continue to work without any callsite changes.

from app.models.ingredient import Ingredient, UnitType
from app.models.macro_target import MacroTarget
from app.models.meal_log import MealLog, MealLogEntry, MealType
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user import RefreshToken, User, UserRole

__all__ = [
    "User",
    "UserRole",
    "RefreshToken",
    "Ingredient",
    "UnitType",
    "MacroTarget",
    "MealLog",
    "MealLogEntry",
    "MealType",
    "Recipe",
    "RecipeIngredient",
]
