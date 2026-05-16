"""nutrition.py — pure nutrition calculation logic (no FastAPI dependency).

This module is the mathematical core of the cooking mode. It can be imported
and tested in isolation without a running database or web framework.

The canonical formula:
    For each ingredient:
        ratio = amount / ingredient.portion_size
        total_macro += ingredient.macro * ratio
    total_kcal += extra_kcal
    per_100g_macro = (total_macro / cooked_weight_g) * 100
"""

from dataclasses import dataclass

MACRO_FIELDS = ("kcal", "protein", "fat", "carbohydrates", "fiber", "sodium")


@dataclass
class IngredientNutrition:
    """Minimal nutrition data for one ingredient (matches the DB Ingredient model)."""

    portion_size: float  # the unit quantity this nutrition is for (e.g. 100 for 100 g)
    kcal: float
    protein: float
    fat: float
    carbohydrates: float
    fiber: float
    sodium: float


@dataclass
class NutritionTotals:
    kcal: float
    protein: float
    fat: float
    carbohydrates: float
    fiber: float
    sodium: float


@dataclass
class NutritionResult:
    totals: NutritionTotals
    per_100g: NutritionTotals


def calculate_nutrition(
    ingredients: list[tuple[IngredientNutrition, float]],
    extra_kcal: float,
    cooked_weight_g: float,
) -> NutritionResult:
    """Calculate nutrition totals and per-100 g values for a cooked recipe.

    Args:
        ingredients: List of (ingredient_nutrition, amount_in_its_unit) pairs.
        extra_kcal: Additional kcal to add (e.g. oil absorbed during frying).
        cooked_weight_g: Actual cooked weight in grams.

    Returns:
        NutritionResult with absolute totals and per-100 g values.

    Raises:
        ValueError: If cooked_weight_g is zero or negative.
    """
    if cooked_weight_g <= 0:
        raise ValueError(f"cooked_weight_g must be positive, got {cooked_weight_g}")

    totals: dict[str, float] = {field: 0.0 for field in MACRO_FIELDS}

    for ingredient, amount in ingredients:
        ratio = amount / ingredient.portion_size
        totals["kcal"] += ingredient.kcal * ratio
        totals["protein"] += ingredient.protein * ratio
        totals["fat"] += ingredient.fat * ratio
        totals["carbohydrates"] += ingredient.carbohydrates * ratio
        totals["fiber"] += ingredient.fiber * ratio
        totals["sodium"] += ingredient.sodium * ratio

    totals["kcal"] += extra_kcal

    per_100g = {k: (v / cooked_weight_g) * 100 for k, v in totals.items()}

    return NutritionResult(
        totals=NutritionTotals(**totals),
        per_100g=NutritionTotals(**per_100g),
    )
