# 01-05 · Cooking Mode Backend — Nutrition Calculation Module, /calculate & /cook Endpoints

**Type:** AFK
**Blocked by:** 01-01

---

## What to build

Implement the nutrition calculation logic as a tested, isolated module on both the backend (Python) and frontend (TypeScript), and expose it via two API endpoints. The calculation module is the mathematical core of the entire application.

The canonical calculation (from the prototype):
```python
def calculate_nutrition(
    ingredients: list[tuple[Ingredient, float]],  # (ingredient, amount_in_its_unit)
    extra_kcal: float,
    cooked_weight_g: float
) -> NutritionResult:
    totals = {field: 0.0 for field in MACRO_FIELDS}
    for ingredient, amount in ingredients:
        ratio = amount / ingredient.portion_size
        totals["kcal"] += ingredient.kcal * ratio
        for macro in ["protein", "fat", "carbohydrates", "fiber", "sodium"]:
            totals[macro] += getattr(ingredient, macro) * ratio
    totals["kcal"] += extra_kcal
    per_100g = {k: (v / cooked_weight_g) * 100 for k, v in totals.items()}
    return NutritionResult(totals=totals, per_100g=per_100g)
```

The TypeScript version must be a pure function with the same logic, published as a utility module (no React dependency). The frontend version powers real-time UI; the backend version is the source of truth for logged values.

Endpoints:
```
POST /recipes/{id}/calculate
  — stateless: accepts { ingredient_amounts, extra_kcal, cooked_weight_g }
  — returns NutritionResult (totals + per_100g for all 6 fields)
  — does NOT write to DB

POST /recipes/{id}/cook
  — same input as /calculate
  — returns NutritionResult
  — persists last_cooked_at = now() and last_cooked_weight_g on the Recipe row
```

## Acceptance criteria

- [ ] Python `calculate_nutrition` module exists as an isolated, importable function (no FastAPI dependency)
- [ ] TypeScript `calculateNutrition` utility module exists as a pure function (no React dependency)
- [ ] Both functions: correct per-100g output for a known 3-ingredient recipe (verified against manual calculation)
- [ ] Both functions: `extra_kcal` is added to total kcal before the per-100g division
- [ ] Both functions: cooked weight different from sum of ingredient weights produces correct per-100g values
- [ ] Both functions: single ingredient recipe produces correct output
- [ ] Both functions: `cooked_weight_g = 0` raises a clear error (division by zero guard)
- [ ] `POST /recipes/{id}/calculate` returns the correct `NutritionResult` without modifying the DB
- [ ] `POST /recipes/{id}/cook` returns the correct `NutritionResult` AND updates `last_cooked_at` + `last_cooked_weight_g` on the recipe
- [ ] Both endpoints return HTTP 404 for another user's recipe
- [ ] Python and TypeScript functions produce identical results for the same inputs (verified by matching test vectors)

## Blocked by

- 01-01 (recipe CRUD backend — endpoints require the Recipe and RecipeIngredient schema)
