/**
 * Tests for calculateNutrition utility.
 *
 * Uses the same test vectors as api/tests/test_nutrition.py to verify
 * identical results between Python and TypeScript implementations.
 */
import { calculateNutrition, IngredientNutrition } from "./nutrition";

function makeIngredient(overrides: Partial<IngredientNutrition> = {}): IngredientNutrition {
  return {
    portion_size: 100,
    kcal: 100,
    protein: 10,
    fat: 5,
    carbohydrates: 8,
    fiber: 2,
    sodium: 0.5,
    ...overrides,
  };
}

describe("calculateNutrition", () => {
  it("single ingredient at exactly portion_size → totals equal ingredient values", () => {
    const ing = makeIngredient({ kcal: 200, protein: 20, fat: 10 });
    const result = calculateNutrition([[ing, 100]], 0, 100);
    expect(result.totals.kcal).toBeCloseTo(200);
    expect(result.totals.protein).toBeCloseTo(20);
    expect(result.totals.fat).toBeCloseTo(10);
  });

  it("single ingredient half portion halves all macros", () => {
    const ing = makeIngredient({ kcal: 200, protein: 20 });
    const result = calculateNutrition([[ing, 50]], 0, 50);
    expect(result.totals.kcal).toBeCloseTo(100);
    expect(result.totals.protein).toBeCloseTo(10);
  });

  it("three-ingredient recipe — manual calculation verification", () => {
    // Same test vectors as Python test_three_ingredient_recipe
    const chicken: IngredientNutrition = {
      portion_size: 100, kcal: 165, protein: 31, fat: 3.6,
      carbohydrates: 0, fiber: 0, sodium: 0.074,
    };
    const oliveOil: IngredientNutrition = {
      portion_size: 100, kcal: 884, protein: 0, fat: 100,
      carbohydrates: 0, fiber: 0, sodium: 0.002,
    };
    const rice: IngredientNutrition = {
      portion_size: 100, kcal: 130, protein: 2.7, fat: 0.3,
      carbohydrates: 28, fiber: 0.4, sodium: 0.001,
    };
    // 200g chicken, 10g oil, 150g rice → cooked 320g
    const result = calculateNutrition(
      [[chicken, 200], [oliveOil, 10], [rice, 150]],
      0,
      320,
    );
    // kcal = 165*2 + 884*0.1 + 130*1.5 = 330 + 88.4 + 195 = 613.4
    expect(result.totals.kcal).toBeCloseTo(613.4);
    expect(result.totals.protein).toBeCloseTo(66.05);
    expect(result.totals.fat).toBeCloseTo(17.65);
    expect(result.totals.carbohydrates).toBeCloseTo(42.0);
    expect(result.per_100g.kcal).toBeCloseTo((613.4 / 320) * 100);
    expect(result.per_100g.protein).toBeCloseTo((66.05 / 320) * 100);
  });

  it("extra_kcal is added to total kcal before per-100g division", () => {
    const ing = makeIngredient({ kcal: 100, protein: 0, fat: 0, carbohydrates: 0, fiber: 0, sodium: 0 });
    const result = calculateNutrition([[ing, 100]], 50, 100);
    expect(result.totals.kcal).toBeCloseTo(150);
    expect(result.per_100g.kcal).toBeCloseTo(150); // 150/100*100
  });

  it("cooked weight different from ingredient weight produces correct per-100g", () => {
    // 300g raw → 200g cooked
    const ing = makeIngredient({ kcal: 200, protein: 30 });
    const result = calculateNutrition([[ing, 300]], 0, 200);
    expect(result.totals.kcal).toBeCloseTo(600);
    expect(result.per_100g.kcal).toBeCloseTo(300); // 600/200*100
    expect(result.per_100g.protein).toBeCloseTo(45); // 90/200*100
  });

  it("cooked_weight_g = 0 throws an error", () => {
    const ing = makeIngredient();
    expect(() => calculateNutrition([[ing, 100]], 0, 0)).toThrow(
      /cookedWeightG must be positive/,
    );
  });

  it("negative cooked weight throws an error", () => {
    const ing = makeIngredient();
    expect(() => calculateNutrition([[ing, 100]], 0, -10)).toThrow();
  });

  it("empty ingredient list with extra_kcal only", () => {
    const result = calculateNutrition([], 100, 200);
    expect(result.totals.kcal).toBeCloseTo(100);
    expect(result.per_100g.kcal).toBeCloseTo(50);
    expect(result.totals.protein).toBeCloseTo(0);
  });

  it("returns object with totals and per_100g keys", () => {
    const ing = makeIngredient();
    const result = calculateNutrition([[ing, 100]], 0, 100);
    expect(result).toHaveProperty("totals");
    expect(result).toHaveProperty("per_100g");
    expect(result.totals).toHaveProperty("kcal");
    expect(result.per_100g).toHaveProperty("kcal");
  });
});
