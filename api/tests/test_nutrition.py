"""Tests for the nutrition calculation module (pure Python, no HTTP)."""

import pytest

from app.nutrition import IngredientNutrition, NutritionResult, calculate_nutrition


def make_ingredient(
    *,
    portion_size: float = 100.0,
    kcal: float = 100.0,
    protein: float = 10.0,
    fat: float = 5.0,
    carbohydrates: float = 8.0,
    fiber: float = 2.0,
    sodium: float = 0.5,
) -> IngredientNutrition:
    return IngredientNutrition(
        portion_size=portion_size,
        kcal=kcal,
        protein=protein,
        fat=fat,
        carbohydrates=carbohydrates,
        fiber=fiber,
        sodium=sodium,
    )


class TestCalculateNutrition:
    def test_single_ingredient_exact_portion(self) -> None:
        """Single ingredient at exactly portion_size amount → totals == ingredient values."""
        ing = make_ingredient(portion_size=100.0, kcal=200.0, protein=20.0, fat=10.0)
        result = calculate_nutrition(
            [(ing, 100.0)], extra_kcal=0.0, cooked_weight_g=100.0
        )
        assert result.totals.kcal == pytest.approx(200.0)
        assert result.totals.protein == pytest.approx(20.0)
        assert result.totals.fat == pytest.approx(10.0)

    def test_single_ingredient_half_portion(self) -> None:
        """Using half the portion_size halves all macros."""
        ing = make_ingredient(portion_size=100.0, kcal=200.0, protein=20.0)
        result = calculate_nutrition(
            [(ing, 50.0)], extra_kcal=0.0, cooked_weight_g=50.0
        )
        assert result.totals.kcal == pytest.approx(100.0)
        assert result.totals.protein == pytest.approx(10.0)

    def test_three_ingredient_recipe(self) -> None:
        """Known 3-ingredient recipe — verify against manual calculation."""
        # Chicken breast: 165 kcal / 100 g, 31 g protein, 3.6 g fat
        chicken = IngredientNutrition(
            portion_size=100.0,
            kcal=165.0,
            protein=31.0,
            fat=3.6,
            carbohydrates=0.0,
            fiber=0.0,
            sodium=0.074,
        )
        # Olive oil: 884 kcal / 100 g, 100 g fat
        olive_oil = IngredientNutrition(
            portion_size=100.0,
            kcal=884.0,
            protein=0.0,
            fat=100.0,
            carbohydrates=0.0,
            fiber=0.0,
            sodium=0.002,
        )
        # Rice: 130 kcal / 100 g, 2.7 g protein, 0.3 g fat, 28 g carbs
        rice = IngredientNutrition(
            portion_size=100.0,
            kcal=130.0,
            protein=2.7,
            fat=0.3,
            carbohydrates=28.0,
            fiber=0.4,
            sodium=0.001,
        )
        # Use: 200 g chicken, 10 g oil, 150 g rice → cooked weight 320 g
        result = calculate_nutrition(
            [(chicken, 200.0), (olive_oil, 10.0), (rice, 150.0)],
            extra_kcal=0.0,
            cooked_weight_g=320.0,
        )
        # Manual totals:
        #   kcal = 165*2 + 884*0.1 + 130*1.5 = 330 + 88.4 + 195 = 613.4
        #   protein = 31*2 + 0 + 2.7*1.5 = 62 + 4.05 = 66.05
        #   fat = 3.6*2 + 100*0.1 + 0.3*1.5 = 7.2 + 10 + 0.45 = 17.65
        #   carbs = 0 + 0 + 28*1.5 = 42.0
        assert result.totals.kcal == pytest.approx(613.4)
        assert result.totals.protein == pytest.approx(66.05)
        assert result.totals.fat == pytest.approx(17.65)
        assert result.totals.carbohydrates == pytest.approx(42.0)
        # per_100g:
        assert result.per_100g.kcal == pytest.approx(613.4 / 320.0 * 100)
        assert result.per_100g.protein == pytest.approx(66.05 / 320.0 * 100)

    def test_extra_kcal_added_before_per_100g(self) -> None:
        """extra_kcal is added to total kcal before the per-100g division."""
        ing = make_ingredient(
            portion_size=100.0,
            kcal=100.0,
            protein=0.0,
            fat=0.0,
            carbohydrates=0.0,
            fiber=0.0,
            sodium=0.0,
        )
        result = calculate_nutrition(
            [(ing, 100.0)], extra_kcal=50.0, cooked_weight_g=100.0
        )
        assert result.totals.kcal == pytest.approx(150.0)
        assert result.per_100g.kcal == pytest.approx(150.0)  # 150/100*100

    def test_cooked_weight_different_from_ingredient_weight(self) -> None:
        """Weight lost during cooking produces correct per-100g values."""
        ing = make_ingredient(portion_size=100.0, kcal=200.0, protein=30.0)
        # 300 g raw → only 200 g cooked (water lost)
        result = calculate_nutrition(
            [(ing, 300.0)], extra_kcal=0.0, cooked_weight_g=200.0
        )
        assert result.totals.kcal == pytest.approx(600.0)
        assert result.per_100g.kcal == pytest.approx(300.0)  # 600/200*100
        assert result.per_100g.protein == pytest.approx(45.0)  # 90/200*100

    def test_zero_cooked_weight_raises(self) -> None:
        """cooked_weight_g = 0 must raise a clear ValueError."""
        ing = make_ingredient()
        with pytest.raises(ValueError, match="cooked_weight_g must be positive"):
            calculate_nutrition([(ing, 100.0)], extra_kcal=0.0, cooked_weight_g=0.0)

    def test_negative_cooked_weight_raises(self) -> None:
        ing = make_ingredient()
        with pytest.raises(ValueError):
            calculate_nutrition([(ing, 100.0)], extra_kcal=0.0, cooked_weight_g=-10.0)

    def test_empty_ingredient_list(self) -> None:
        """No ingredients + extra_kcal only."""
        result = calculate_nutrition([], extra_kcal=100.0, cooked_weight_g=200.0)
        assert result.totals.kcal == pytest.approx(100.0)
        assert result.per_100g.kcal == pytest.approx(50.0)
        assert result.totals.protein == pytest.approx(0.0)

    def test_result_type(self) -> None:
        ing = make_ingredient()
        result = calculate_nutrition(
            [(ing, 100.0)], extra_kcal=0.0, cooked_weight_g=100.0
        )
        assert isinstance(result, NutritionResult)
