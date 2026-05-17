/**
 * CookingModePage — Full-screen cooking mode.
 *
 * Two modes:
 *  - Recipe mode: /recipes/:recipeId/cook — loads recipe from API, shows "Save cook result"
 *  - Ad-hoc mode: /cook — starts with empty ingredient list, no "Save cook result"
 *
 * Nutrition recalculates synchronously on every keystroke using the
 * calculateNutrition utility — no debounce, no network call.
 */

import { useEffect, useReducer, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getRecipeRecipesRecipeIdGet,
  cookRecipeRecipesRecipeIdCookPost,
} from "../client/services.gen";
import type { RecipeDetail, RecipeIngredientItem } from "../client/types.gen";
import {
  calculateNutrition,
  type IngredientNutrition,
} from "../lib/nutrition";
import { useToast } from "../hooks/useToast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CookingIngredient {
  recipeIngredientId: number;
  ingredientId: number;
  name: string;
  unit: string;
  icon: string | null;
  amount: number;
  /** Nutrition per portion_size */
  nutrition: IngredientNutrition;
}

type PortionMode = "weight" | "kcal";

interface CookingState {
  /** null = not yet loaded, undefined = no recipe (ad-hoc) */
  recipe: RecipeDetail | null | undefined;
  isLoading: boolean;
  isSaving: boolean;
  ingredients: CookingIngredient[];
  /** Has user manually edited the cooked weight? */
  cookedWeightOverride: number | null;
  extraKcal: number;
  portionMode: PortionMode;
  portionValue: number | null;
}

type CookingAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_RECIPE"; payload: RecipeDetail }
  | { type: "SET_ADHOC" }
  | { type: "SET_INGREDIENT_AMOUNT"; index: number; value: number }
  | { type: "SET_COOKED_WEIGHT"; value: number | null }
  | { type: "SET_EXTRA_KCAL"; value: number }
  | { type: "SET_PORTION_MODE"; mode: PortionMode }
  | { type: "SET_PORTION_VALUE"; value: number | null }
  | { type: "SET_SAVING"; payload: boolean };

function sumAmounts(ingredients: CookingIngredient[]): number {
  return ingredients.reduce((s, i) => s + i.amount, 0);
}

function fromRecipeIngredient(ri: RecipeIngredientItem): CookingIngredient {
  return {
    recipeIngredientId: ri.id,
    ingredientId: ri.ingredient_id,
    name: ri.ingredient.name,
    unit: ri.ingredient.unit,
    icon: ri.ingredient.icon ?? null,
    amount: ri.amount,
    nutrition: {
      portion_size: ri.ingredient.portion_size,
      kcal: ri.ingredient.kcal,
      protein: ri.ingredient.protein,
      fat: ri.ingredient.fat,
      carbohydrates: ri.ingredient.carbohydrates,
      fiber: ri.ingredient.fiber,
      sodium: ri.ingredient.sodium,
    },
  };
}

function reducer(state: CookingState, action: CookingAction): CookingState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_RECIPE": {
      const ingredients = action.payload.ingredients.map(fromRecipeIngredient);
      return {
        ...state,
        recipe: action.payload,
        isLoading: false,
        ingredients,
        cookedWeightOverride: null,
      };
    }
    case "SET_ADHOC":
      return { ...state, recipe: undefined, isLoading: false, ingredients: [] };
    case "SET_INGREDIENT_AMOUNT": {
      const ingredients = state.ingredients.map((ing, i) =>
        i === action.index ? { ...ing, amount: action.value } : ing,
      );
      return { ...state, ingredients };
    }
    case "SET_COOKED_WEIGHT":
      return { ...state, cookedWeightOverride: action.value };
    case "SET_EXTRA_KCAL":
      return { ...state, extraKcal: action.value };
    case "SET_PORTION_MODE":
      return { ...state, portionMode: action.mode, portionValue: null };
    case "SET_PORTION_VALUE":
      return { ...state, portionValue: action.value };
    case "SET_SAVING":
      return { ...state, isSaving: action.payload };
    default:
      return state;
  }
}

const initialState: CookingState = {
  recipe: null,
  isLoading: false,
  isSaving: false,
  ingredients: [],
  cookedWeightOverride: null,
  extraKcal: 0,
  portionMode: "weight",
  portionValue: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(v: number, decimals = 0): string {
  return parseFloat(v.toFixed(decimals)).toString();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface IngredientRowProps {
  ingredient: CookingIngredient;
  index: number;
  onChange: (index: number, value: number) => void;
}

function IngredientRow({
  ingredient,
  index,
  onChange,
}: IngredientRowProps) {
  const kcalForAmount =
    (ingredient.nutrition.kcal / ingredient.nutrition.portion_size) *
    ingredient.amount;

  return (
    <div
      className="c-ing-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px 7px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Icon */}
      <div
        className="c-ing-icon"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: "var(--cream-dark, #EDE4D9)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {ingredient.icon ?? "🍽️"}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "hsl(var(--foreground))",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {ingredient.name}
        </div>
        <div
          data-testid={`ing-kcal-${index}`}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "hsl(var(--primary))",
          }}
        >
          {fmt(kcalForAmount)} kcal
        </div>
      </div>

      {/* Amount input */}
      <div
        className="c-amount-group"
        style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
      >
        <input
          type="number"
          inputMode="decimal"
          aria-label={`Amount of ${ingredient.name}`}
          value={ingredient.amount === 0 ? "" : ingredient.amount}
          min={0}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            onChange(index, isNaN(val) ? 0 : Math.max(0, val));
          }}
          style={{
            width: 64,
            height: 44,
            fontFamily: "var(--font-body)",
            fontSize: 18,
            fontWeight: 600,
            textAlign: "center",
            color: "hsl(var(--foreground))",
            background: "white",
            border: "1.5px solid var(--border)",
            borderRadius: 9,
            outline: "none",
            padding: "0 4px",
            MozAppearance: "textfield",
            appearance: "textfield",
          }}
        />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: "hsl(var(--muted-foreground))",
            minWidth: 30,
          }}
        >
          {ingredient.unit}
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CookingModePage() {
  const { recipeId } = useParams<{ recipeId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    isLoading: !!recipeId,
  });

  // ── Load recipe ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recipeId) {
      dispatch({ type: "SET_ADHOC" });
      return;
    }
    dispatch({ type: "SET_LOADING", payload: true });
    getRecipeRecipesRecipeIdGet({ recipeId: Number(recipeId) })
      .then((recipe) => dispatch({ type: "SET_RECIPE", payload: recipe }))
      .catch(() => {
        dispatch({ type: "SET_LOADING", payload: false });
        toastRef.current({
          title: "Failed to load recipe",
          variant: "destructive",
        });
        navigate(-1);
      });
  }, [recipeId, navigate]);

  // ── Derived values ───────────────────────────────────────────────────────────

  const sumAmountsVal = sumAmounts(state.ingredients);
  const cookedWeight =
    state.cookedWeightOverride !== null
      ? state.cookedWeightOverride
      : sumAmountsVal;

  const isZeroWeight = cookedWeight <= 0;

  let nutritionResult: ReturnType<typeof calculateNutrition> | null = null;
  if (!isZeroWeight && state.ingredients.length > 0) {
    try {
      nutritionResult = calculateNutrition(
        state.ingredients.map((ing) => [ing.nutrition, ing.amount]),
        state.extraKcal,
        cookedWeight,
      );
    } catch {
      // cookedWeightG <= 0, handled by isZeroWeight
    }
  } else if (!isZeroWeight && state.extraKcal > 0) {
    // Ad-hoc with no ingredients but extra kcal
    try {
      nutritionResult = calculateNutrition([], state.extraKcal, cookedWeight);
    } catch {
      // ignore
    }
  }

  const totalKcal = nutritionResult
    ? nutritionResult.totals.kcal
    : state.ingredients.reduce(
        (s, ing) =>
          s +
          (ing.nutrition.kcal / ing.nutrition.portion_size) * ing.amount,
        0,
      ) + state.extraKcal;

  const per100g = nutritionResult?.per_100g ?? null;

  // ── Portion calculation ──────────────────────────────────────────────────────
  let portionKcal: number | null = null;
  let portionWeightG: number | null = null;
  let portionProtein: number | null = null;
  let portionFat: number | null = null;
  let portionCarbs: number | null = null;

  if (per100g && state.portionValue !== null && state.portionValue > 0) {
    if (state.portionMode === "weight") {
      portionWeightG = state.portionValue;
      portionKcal = (per100g.kcal / 100) * portionWeightG;
    } else {
      portionKcal = state.portionValue;
      portionWeightG =
        per100g.kcal > 0 ? (state.portionValue / per100g.kcal) * 100 : 0;
    }
    portionProtein = (per100g.protein / 100) * (portionWeightG ?? 0);
    portionFat = (per100g.fat / 100) * (portionWeightG ?? 0);
    portionCarbs = (per100g.carbohydrates / 100) * (portionWeightG ?? 0);
  }

  const portionReady = portionKcal !== null && per100g !== null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleIngredientChange = useCallback(
    (index: number, value: number) => {
      dispatch({ type: "SET_INGREDIENT_AMOUNT", index, value });
      // Reset cooked weight override so it tracks sum again if not manually edited
      // (We only reset if user hasn't manually overridden)
    },
    [],
  );

  const handleSaveCook = async () => {
    if (!recipeId || isZeroWeight) return;
    dispatch({ type: "SET_SAVING", payload: true });
    try {
      await cookRecipeRecipesRecipeIdCookPost({
        recipeId: Number(recipeId),
        requestBody: {
          ingredient_amounts: state.ingredients.map((ing) => ({
            ingredient_id: ing.ingredientId,
            amount: ing.amount,
          })),
          extra_kcal: state.extraKcal,
          cooked_weight_g: cookedWeight,
        },
      });
      toastRef.current({ title: "Cook result saved!", variant: "success" });
    } catch {
      toastRef.current({ title: "Failed to save cook result", variant: "destructive" });
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (state.isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading recipe"
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(var(--background))",
        }}
      >
        <svg
          className="animate-spin"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  const recipeName =
    state.recipe?.name ?? (recipeId ? "Recipe" : "Ad-hoc cook");

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="cooking-shell"
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "hsl(var(--background))",
      }}
    >
      {/* ── Header ── */}
      <header
        className="cooking-header"
        style={{
          height: 54,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 14px 0 6px",
          background: "hsl(var(--muted))",
          borderBottom: "1px solid hsl(var(--border))",
          zIndex: 20,
          gap: 4,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "hsl(var(--muted-foreground))",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 15l-5-5 5-5" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: 16,
              fontWeight: 700,
              color: "hsl(var(--foreground))",
              letterSpacing: "-0.2px",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {recipeName}
          </div>
          {/* Cooking Mode badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "hsl(var(--primary))",
              marginTop: 1,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "hsl(var(--primary))",
                display: "inline-block",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            Cooking Mode
          </div>
        </div>
      </header>

      {/* ── Sanity strip ── */}
      <div
        aria-label="Batch summary"
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          height: 34,
          background: "hsl(var(--secondary) / 0.4)",
          borderBottom: "1px solid hsl(var(--primary) / 0.18)",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.7px",
              textTransform: "uppercase",
              color: "hsl(var(--primary) / 0.55)",
            }}
          >
            Batch
          </span>
          <span
            data-testid="banner-kcal"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 700,
              color: "hsl(var(--primary))",
            }}
          >
            {fmt(totalKcal)}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "hsl(var(--primary) / 0.6)" }}>
            kcal
          </span>
        </div>
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "hsl(var(--primary) / 0.25)",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.7px",
              textTransform: "uppercase",
              color: "hsl(var(--primary) / 0.55)",
            }}
          >
            Cooked
          </span>
          <span
            data-testid="banner-weight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 700,
              color: "hsl(var(--primary))",
            }}
          >
            {cookedWeight > 0 ? cookedWeight : "—"}
          </span>
          {cookedWeight > 0 && (
            <span style={{ fontSize: 10.5, fontWeight: 500, color: "hsl(var(--primary) / 0.6)" }}>
              g
            </span>
          )}
        </div>
      </div>

      {/* ── Scroll area ── */}
      <div
        style={{
          flex: 1,
          position: "relative",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Fade gradient at bottom */}
        <div
          aria-hidden="true"
          style={{
            content: "''",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
        <div
          style={{
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            padding: "4px 0 8px",
          }}
        >
          {/* Section label */}
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: "hsl(var(--muted-foreground))",
              padding: "6px 18px 3px",
            }}
          >
            Ingredients
          </div>

          {/* Ingredient rows */}
          {state.ingredients.map((ing, i) => (
            <IngredientRow
              key={ing.recipeIngredientId}
              ingredient={ing}
              index={i}
              onChange={handleIngredientChange}
            />
          ))}

          {/* Ad-hoc: Add ingredient button */}
          {state.recipe === undefined && (
            <div style={{ padding: "10px 16px" }}>
              <button
                style={{
                  width: "100%",
                  height: 44,
                  border: "1.5px dashed hsl(var(--border))",
                  borderRadius: 10,
                  background: "transparent",
                  color: "hsl(var(--muted-foreground))",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
                aria-label="Add ingredient"
                onClick={() => {
                  /* TODO: open ingredient search */
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add ingredient
              </button>
            </div>
          )}

          {/* Extra calories row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px 7px 16px",
              borderBottom: "1px solid hsl(var(--border))",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "hsl(var(--muted))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              🫙
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                Extra calories
              </div>
              <div
                style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
              >
                Oil spray, seasoning…
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <input
                type="number"
                inputMode="decimal"
                aria-label="Extra calories"
                value={state.extraKcal === 0 ? "" : state.extraKcal}
                min={0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  dispatch({
                    type: "SET_EXTRA_KCAL",
                    value: isNaN(val) ? 0 : Math.max(0, val),
                  });
                }}
                style={{
                  width: 64,
                  height: 44,
                  fontFamily: "var(--font-body)",
                  fontSize: 18,
                  fontWeight: 600,
                  textAlign: "center",
                  color: "hsl(var(--foreground))",
                  background: "white",
                  border: "1.5px solid hsl(var(--border))",
                  borderRadius: 9,
                  outline: "none",
                  padding: "0 4px",
                  MozAppearance: "textfield",
                  appearance: "textfield",
                }}
              />
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "hsl(var(--muted-foreground))",
                  minWidth: 30,
                }}
              >
                kcal
              </span>
            </div>
          </div>

          {/* Cooked Weight callout */}
          <div
            style={{
              margin: "10px 14px 6px",
              background:
                "linear-gradient(140deg, hsl(var(--secondary)) 0%, hsl(var(--secondary) / 0.4) 100%)",
              border: "1.5px solid hsl(var(--primary) / 0.25)",
              borderRadius: 14,
              padding: "14px 16px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: "hsl(var(--primary) / 0.13)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
                aria-hidden="true"
              >
                ⚖️
              </div>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "hsl(var(--primary))",
                }}
              >
                Total Cooked Weight
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  color: "hsl(var(--primary))",
                  background: "hsl(var(--primary) / 0.10)",
                  padding: "2px 7px",
                  borderRadius: 10,
                  marginLeft: "auto",
                }}
              >
                Key input
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                aria-label="Total Cooked Weight"
                value={cookedWeight === 0 ? "" : cookedWeight}
                min={0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  dispatch({
                    type: "SET_COOKED_WEIGHT",
                    value: isNaN(val) ? 0 : Math.max(0, val),
                  });
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 56,
                  fontFamily: "var(--font-body)",
                  fontSize: 26,
                  fontWeight: 700,
                  textAlign: "center",
                  color: "hsl(var(--primary))",
                  background: "white",
                  border: "2px solid hsl(var(--primary) / 0.28)",
                  borderRadius: 8,
                  outline: "none",
                  padding: "0 10px",
                  MozAppearance: "textfield",
                  appearance: "textfield",
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "hsl(var(--primary))",
                  flexShrink: 0,
                }}
              >
                g
              </span>
            </div>
            <p
              style={{
                fontSize: 11,
                color: "hsl(var(--primary) / 0.65)",
                marginTop: 8,
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              Weigh the dish after cooking for accurate per-100g nutrition
            </p>
          </div>

          {/* Zero weight warning */}
          {isZeroWeight && (
            <div
              role="alert"
              style={{
                margin: "8px 14px",
                padding: "10px 14px",
                background: "hsl(var(--destructive) / 0.1)",
                border: "1px solid hsl(var(--destructive) / 0.3)",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(var(--destructive))",
                fontWeight: 500,
              }}
            >
              Enter a cooked weight to calculate per-100g nutrition
            </div>
          )}

          {/* Save cook result (recipe mode only) */}
          {recipeId && (
            <div style={{ padding: "10px 14px 4px" }}>
              <button
                onClick={() => void handleSaveCook()}
                disabled={state.isSaving || isZeroWeight}
                style={{
                  width: "100%",
                  height: 44,
                  background: "hsl(var(--muted))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                  cursor: state.isSaving || isZeroWeight ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  opacity: state.isSaving || isZeroWeight ? 0.6 : 1,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M15 3H3v12h12V3z" />
                  <path d="M6 3v5h6V3M6 15v-5h6v5" />
                </svg>
                {state.isSaving ? "Saving…" : "Save cook result"}
              </button>
            </div>
          )}

          <div style={{ height: 28 }} />
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div
        style={{
          flexShrink: 0,
          background: "white",
          borderTop: "1px solid hsl(var(--border))",
          boxShadow: "0 -2px 20px rgba(26,18,8,0.06)",
          zIndex: 10,
        }}
      >
        {/* Per-100g strip */}
        <div
          aria-label="Per 100g nutrition"
          style={{
            display: "flex",
            alignItems: "flex-start",
            padding: "10px 16px 9px",
            gap: 8,
            borderBottom: "1px solid hsl(var(--border))",
            minHeight: 44,
            flexWrap: "wrap",
            opacity: isZeroWeight ? 0.45 : 1,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "hsl(var(--muted-foreground))",
              flexShrink: 0,
              marginRight: 2,
              paddingTop: 2,
            }}
          >
            per 100g
          </span>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", rowGap: 2 }}>
            <span
              data-testid="p100-kcal"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: isZeroWeight
                  ? "hsl(var(--muted-foreground))"
                  : "hsl(var(--primary))",
              }}
            >
              {per100g ? fmt(per100g.kcal) : "—"}
            </span>
            <span
              style={{ fontSize: 11.5, fontWeight: 400, color: "hsl(var(--muted-foreground))", marginRight: 6 }}
            >
              {" "}kcal
            </span>
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: "50%",
                background: "hsl(var(--border))",
                margin: "0 5px 3px",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            <span
              data-testid="p100-protein"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: isZeroWeight ? "hsl(var(--muted-foreground))" : "#2B6B8A",
              }}
            >
              {per100g ? fmt(per100g.protein, 1) : "—"}
            </span>
            <span
              style={{ fontSize: 11.5, color: "hsl(var(--muted-foreground))", marginRight: 6 }}
            >
              g P
            </span>
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: "50%",
                background: "hsl(var(--border))",
                margin: "0 5px 3px",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            <span
              data-testid="p100-fat"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: isZeroWeight ? "hsl(var(--muted-foreground))" : "#8A6B2B",
              }}
            >
              {per100g ? fmt(per100g.fat, 1) : "—"}
            </span>
            <span
              style={{ fontSize: 11.5, color: "hsl(var(--muted-foreground))", marginRight: 6 }}
            >
              g F
            </span>
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: "50%",
                background: "hsl(var(--border))",
                margin: "0 5px 3px",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            <span
              data-testid="p100-carbs"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: isZeroWeight ? "hsl(var(--muted-foreground))" : "#2B7A4B",
              }}
            >
              {per100g ? fmt(per100g.carbohydrates, 1) : "—"}
            </span>
            <span
              style={{ fontSize: 11.5, color: "hsl(var(--muted-foreground))" }}
            >
              g C
            </span>
          </div>
        </div>

        {/* Portion section */}
        <div style={{ padding: "8px 16px 0" }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "hsl(var(--muted-foreground))",
              marginBottom: 6,
            }}
          >
            How much am I eating?
          </div>

          {/* Mode toggle */}
          <div
            role="group"
            aria-label="Portion mode"
            style={{
              display: "flex",
              gap: 4,
              background: "hsl(var(--muted))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              padding: 3,
              marginBottom: 9,
            }}
          >
            {(["weight", "kcal"] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={state.portionMode === mode}
                onClick={() => dispatch({ type: "SET_PORTION_MODE", mode })}
                style={{
                  flex: 1,
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color:
                    state.portionMode === mode
                      ? "hsl(var(--primary))"
                      : "hsl(var(--muted-foreground))",
                  background:
                    state.portionMode === mode ? "white" : "transparent",
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                  boxShadow:
                    state.portionMode === mode
                      ? "0 1px 6px rgba(26,18,8,0.10)"
                      : "none",
                }}
              >
                {mode === "weight" ? (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 13 13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <rect x="1" y="4" width="11" height="8" rx="1.5" />
                      <path d="M4.5 4V3a2 2 0 0 1 4 0v1" />
                    </svg>
                    by weight
                  </>
                ) : (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 13 13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <path d="M6.5 1v11M3 4.5l3.5-3.5L10 4.5M3 8.5l3.5 3.5L10 8.5" />
                    </svg>
                    by kcal
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Portion input */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <input
              type="number"
              inputMode="decimal"
              aria-label={`Portion ${state.portionMode === "weight" ? "weight in grams" : "in kcal"}`}
              placeholder="0"
              value={state.portionValue === null || state.portionValue === 0 ? "" : state.portionValue}
              min={0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                dispatch({
                  type: "SET_PORTION_VALUE",
                  value: isNaN(val) ? null : Math.max(0, val),
                });
              }}
              style={{
                flex: 1,
                minWidth: 0,
                height: 50,
                fontFamily: "var(--font-body)",
                fontSize: 24,
                fontWeight: 700,
                textAlign: "center",
                color:
                  portionReady
                    ? "hsl(var(--primary))"
                    : "hsl(var(--foreground))",
                background:
                  portionReady ? "white" : "hsl(var(--muted))",
                border: `1.5px solid ${portionReady ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border))"}`,
                borderRadius: 8,
                outline: "none",
                padding: "0 8px",
                MozAppearance: "textfield",
                appearance: "textfield",
              }}
            />
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "hsl(var(--muted-foreground))",
                flexShrink: 0,
                minWidth: 30,
              }}
            >
              {state.portionMode === "weight" ? "g" : "kcal"}
            </span>
          </div>

          {/* Derived weight (kcal mode) */}
          {state.portionMode === "kcal" && portionWeightG !== null && portionWeightG > 0 && (
            <div
              style={{
                fontSize: 12,
                color: "hsl(var(--muted-foreground))",
                fontStyle: "italic",
                textAlign: "center",
                marginTop: -6,
                marginBottom: 6,
              }}
            >
              ≈ <strong>{fmt(portionWeightG)}g</strong> portion weight
            </div>
          )}

          {/* Empty hint or results */}
          {!portionReady ? (
            <div
              style={{
                fontSize: 11.5,
                color: "hsl(var(--muted-foreground))",
                fontStyle: "italic",
                padding: "2px 2px 8px",
              }}
            >
              {isZeroWeight && state.portionValue !== null && state.portionValue > 0
                ? "Enter cooked weight above first"
                : "Enter a weight to see your serving's nutrition"}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
                padding: "10px 14px",
                background: "linear-gradient(135deg, hsl(var(--secondary) / 0.5) 0%, hsl(var(--background)) 100%)",
                borderRadius: 8,
                border: "1.5px solid hsl(var(--primary) / 0.18)",
                marginBottom: 7,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 38,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: "hsl(var(--primary))",
                  }}
                >
                  {portionKcal !== null ? fmt(portionKcal) : "—"}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "hsl(var(--primary))",
                    opacity: 0.75,
                    paddingBottom: 4,
                  }}
                >
                  kcal
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    color: "hsl(var(--muted-foreground))",
                    marginLeft: "auto",
                    alignSelf: "center",
                  }}
                >
                  {state.portionMode === "weight"
                    ? `in ${portionWeightG ?? 0}g`
                    : `≈ from ${portionWeightG !== null ? fmt(portionWeightG) : "—"}g`}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 2,
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 700,
                    background: "#E8F4F8",
                    color: "#2B6B8A",
                  }}
                >
                  {portionProtein !== null ? fmt(portionProtein, 1) : "—"}
                  <span style={{ fontSize: 10.5, fontWeight: 500, marginLeft: 1 }}>
                    g protein
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 2,
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 700,
                    background: "#F8F3E8",
                    color: "#8A6B2B",
                  }}
                >
                  {portionFat !== null ? fmt(portionFat, 1) : "—"}
                  <span style={{ fontSize: 10.5, fontWeight: 500, marginLeft: 1 }}>
                    g fat
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 2,
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 700,
                    background: "#E8F5EE",
                    color: "#2B7A4B",
                  }}
                >
                  {portionCarbs !== null ? fmt(portionCarbs, 1) : "—"}
                  <span style={{ fontSize: 10.5, fontWeight: 500, marginLeft: 1 }}>
                    g carbs
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CTA row */}
        <div style={{ padding: "0 16px 12px" }}>
          <button
            disabled
            title="Available after logging is implemented"
            aria-label="Log this portion"
            style={{
              width: "100%",
              height: 50,
              background: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
              border: "none",
              borderRadius: 8,
              fontFamily: "var(--font-body)",
              fontSize: 14.5,
              fontWeight: 600,
              cursor: "not-allowed",
              boxShadow: "none",
              opacity: 0.6,
            }}
          >
            Log this portion
          </button>
        </div>
      </div>
    </div>
  );
}
