/**
 * nutrition.ts — Pure TypeScript nutrition calculation utility.
 *
 * No React dependency. This module is the frontend mirror of
 * api/app/nutrition.py and must produce identical results for the same inputs.
 *
 * Used by cooking-mode UI for real-time per-100g display.
 * The backend is the authoritative source of truth when logging.
 */

export interface IngredientNutrition {
  /** The unit quantity this nutrition data is for (e.g. 100 for per-100 g). */
  portion_size: number;
  kcal: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
  sodium: number;
}

export interface MacroValues {
  kcal: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
  sodium: number;
}

export interface NutritionResult {
  totals: MacroValues;
  per_100g: MacroValues;
}

type IngredientAmountPair = [IngredientNutrition, number];

const ZERO_MACROS: MacroValues = {
  kcal: 0,
  protein: 0,
  fat: 0,
  carbohydrates: 0,
  fiber: 0,
  sodium: 0,
};

/**
 * Calculate nutrition totals and per-100 g values for a cooked recipe.
 *
 * @param ingredients - Array of [ingredientNutrition, amountInItsUnit] pairs.
 * @param extraKcal - Additional kcal to add (e.g. oil absorbed during frying).
 * @param cookedWeightG - Actual cooked weight in grams.
 * @returns NutritionResult with absolute totals and per-100 g values.
 * @throws Error if cookedWeightG is zero or negative.
 */
export function calculateNutrition(
  ingredients: IngredientAmountPair[],
  extraKcal: number,
  cookedWeightG: number
): NutritionResult {
  if (cookedWeightG <= 0) {
    throw new Error(`cookedWeightG must be positive, got ${cookedWeightG}`);
  }

  const totals: MacroValues = { ...ZERO_MACROS };

  for (const [ingredient, amount] of ingredients) {
    const ratio = amount / ingredient.portion_size;
    totals.kcal += ingredient.kcal * ratio;
    totals.protein += ingredient.protein * ratio;
    totals.fat += ingredient.fat * ratio;
    totals.carbohydrates += ingredient.carbohydrates * ratio;
    totals.fiber += ingredient.fiber * ratio;
    totals.sodium += ingredient.sodium * ratio;
  }

  totals.kcal += extraKcal;

  const per_100g: MacroValues = {
    kcal: (totals.kcal / cookedWeightG) * 100,
    protein: (totals.protein / cookedWeightG) * 100,
    fat: (totals.fat / cookedWeightG) * 100,
    carbohydrates: (totals.carbohydrates / cookedWeightG) * 100,
    fiber: (totals.fiber / cookedWeightG) * 100,
    sodium: (totals.sodium / cookedWeightG) * 100,
  };

  return { totals, per_100g };
}
