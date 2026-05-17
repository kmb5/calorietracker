/**
 * CookingModePage tests
 *
 * Tests cover:
 * - Loading state while fetching recipe
 * - Recipe ingredients pre-filled from API
 * - Per-100g nutrition recalculates when ingredient amount changes
 * - Cooked weight defaults to sum of ingredient amounts
 * - Changing cooked weight updates per-100g panel
 * - Extra calories add to total kcal
 * - Zero cooked weight shows a warning
 * - "Save cook result" calls POST /recipes/{id}/cook
 * - "Log this portion" button is visible but disabled
 * - Ad-hoc mode (no recipeId): empty ingredient list
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CookingModePage } from "./CookingModePage";
import {
  getRecipeRecipesRecipeIdGet,
  cookRecipeRecipesRecipeIdCookPost,
} from "../client/services.gen";
import type { RecipeDetail } from "../client/types.gen";

// ── Mocks ──────────────────────────────────────────────────────────────────────
jest.mock("../client/services.gen", () => ({
  getRecipeRecipesRecipeIdGet: jest.fn(),
  cookRecipeRecipesRecipeIdCookPost: jest.fn(),
  searchIngredientsIngredientsSearchGet: jest.fn().mockResolvedValue([]),
  getIngredientIngredientsIngredientIdGet: jest.fn(),
}));

jest.mock("../hooks/useToast", () => {
  const mockToast = jest.fn();
  return {
    ...jest.requireActual("../hooks/useToast"),
    useToast: () => ({ toast: mockToast }),
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockGetRecipe = getRecipeRecipesRecipeIdGet as jest.MockedFunction<
  typeof getRecipeRecipesRecipeIdGet
>;
const mockCookRecipe = cookRecipeRecipesRecipeIdCookPost as jest.MockedFunction<
  typeof cookRecipeRecipesRecipeIdCookPost
>;

function makeRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 1,
    owner_id: 1,
    name: "Lemon Herb Chicken",
    description: null,
    last_cooked_at: null,
    last_cooked_weight_g: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ingredients: [
      {
        id: 1,
        ingredient_id: 10,
        amount: 200,
        display_order: 0,
        ingredient: {
          id: 10,
          name: "Chicken Breast",
          unit: "g" as const,
          portion_size: 100,
          kcal: 165,
          protein: 31,
          fat: 3.6,
          carbohydrates: 0,
          fiber: 0,
          sodium: 74,
          icon: "🍗",
          is_system: true,
          is_promotion_pending: false,
          owner_id: null,
          promotion_rejection_note: null,
        },
      },
      {
        id: 2,
        ingredient_id: 11,
        amount: 50,
        display_order: 1,
        ingredient: {
          id: 11,
          name: "Lemon Juice",
          unit: "ml" as const,
          portion_size: 100,
          kcal: 25,
          protein: 0.4,
          fat: 0.2,
          carbohydrates: 6.7,
          fiber: 0.3,
          sodium: 2,
          icon: "🍋",
          is_system: true,
          is_promotion_pending: false,
          owner_id: null,
          promotion_rejection_note: null,
        },
      },
    ],
    ...overrides,
  };
}

function renderWithRouter(recipeId?: string) {
  const path = recipeId ? `/recipes/${recipeId}/cook` : "/cook";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recipes/:recipeId/cook" element={<CookingModePage />} />
        <Route path="/cook" element={<CookingModePage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("CookingModePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Recipe mode (with recipeId)", () => {
    it("shows a loading state while fetching recipe", async () => {
      mockGetRecipe.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => new Promise(() => {}) as any // never resolves
      );
      renderWithRouter("1");
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("pre-fills ingredient amounts from the recipe", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      // Wait for ingredients to render
      await waitFor(() => expect(screen.getByDisplayValue("200")).toBeInTheDocument());
      expect(screen.getByDisplayValue("50")).toBeInTheDocument();
    });

    it("displays ingredient names", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      await waitFor(() =>
        expect(screen.getByText("Chicken Breast")).toBeInTheDocument()
      );
      expect(screen.getByText("Lemon Juice")).toBeInTheDocument();
    });

    it("defaults Total Cooked Weight to sum of ingredient amounts", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      // 200 + 50 = 250
      await waitFor(() =>
        expect(screen.getByLabelText("Total Cooked Weight")).toHaveValue(250)
      );
    });

    it("per-100g kcal updates when ingredient amount changes", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      await waitFor(() => expect(screen.getByDisplayValue("200")).toBeInTheDocument());

      // Initially: totals = 200*(165/100) + 50*(25/100) = 330 + 12.5 = 342.5 kcal
      // cooked weight = 250 (sum of ingredients), per100g = 342.5/250*100 = 137
      expect(screen.getByTestId("p100-kcal")).toHaveTextContent("137");

      // Change chicken amount to 100
      const chickenInput = screen.getByDisplayValue("200");
      fireEvent.change(chickenInput, { target: { value: "100" } });

      // New totals = 100*(165/100) + 50*(25/100) = 165 + 12.5 = 177.5 kcal
      // cooked weight = sum = 100 + 50 = 150 (tracking sum, not overridden)
      // per100g = 177.5/150*100 = 118.3 → 118
      expect(screen.getByTestId("p100-kcal")).toHaveTextContent("118");
    });

    it("per-100g panel updates when cooked weight changes", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      await waitFor(() =>
        expect(screen.getByLabelText("Total Cooked Weight")).toBeInTheDocument()
      );

      const cwInput = screen.getByLabelText("Total Cooked Weight");
      fireEvent.change(cwInput, { target: { value: "500" } });

      // totals kcal = 330 + 12.5 = 342.5, new per100g = 342.5/500*100 = 68.5 → 69
      const p100 = screen.getByTestId("p100-kcal").textContent ?? "";
      expect(Number(p100)).toBeGreaterThan(0);
      expect(Number(p100)).toBeLessThan(137);
    });

    it("extra kcal adds to total before per-100g division", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      await waitFor(() =>
        expect(screen.getByLabelText("Extra calories")).toBeInTheDocument()
      );

      const extraInput = screen.getByLabelText("Extra calories");
      const before = screen.getByTestId("p100-kcal").textContent;

      fireEvent.change(extraInput, { target: { value: "100" } });

      const after = screen.getByTestId("p100-kcal").textContent;
      expect(Number(after)).toBeGreaterThan(Number(before));
    });

    it("shows warning and hides per-100g panel when cooked weight is zero", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      await waitFor(() =>
        expect(screen.getByLabelText("Total Cooked Weight")).toBeInTheDocument()
      );

      fireEvent.change(screen.getByLabelText("Total Cooked Weight"), {
        target: { value: "0" },
      });

      expect(screen.getByRole("alert")).toBeInTheDocument();
      // per-100g values should show dashes
      expect(screen.getByTestId("p100-kcal")).toHaveTextContent("—");
    });

    it('"Save cook result" button is visible in recipe mode', async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      await waitFor(() =>
        expect(screen.getByText(/save cook result/i)).toBeInTheDocument()
      );
    });

    it("calls POST /recipes/{id}/cook when Save cook result is clicked", async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      mockCookRecipe.mockResolvedValue({
        totals: {
          kcal: 342.5,
          protein: 62.2,
          fat: 7.3,
          carbohydrates: 3.35,
          fiber: 0.15,
          sodium: 149,
        },
        per_100g: {
          kcal: 137,
          protein: 24.9,
          fat: 2.92,
          carbohydrates: 1.34,
          fiber: 0.06,
          sodium: 59.6,
        },
      });

      renderWithRouter("1");

      await waitFor(() =>
        expect(screen.getByText(/save cook result/i)).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByText(/save cook result/i));
      });

      expect(mockCookRecipe).toHaveBeenCalledWith({
        recipeId: 1,
        requestBody: expect.objectContaining({
          cooked_weight_g: 250,
        }),
      });
    });

    it('"Log this portion" button is visible but disabled', async () => {
      mockGetRecipe.mockResolvedValue(makeRecipe());
      renderWithRouter("1");

      await waitFor(() =>
        expect(screen.getByText(/log this portion/i)).toBeInTheDocument()
      );

      expect(screen.getByText(/log this portion/i)).toBeDisabled();
    });
  });

  describe("Ad-hoc mode (no recipeId)", () => {
    it("starts with an empty ingredient list", () => {
      renderWithRouter(); // no recipeId → /cook
      // No loading spinner (no API call)
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      // No ingredient rows
      expect(screen.queryByDisplayValue("200")).not.toBeInTheDocument();
    });

    it("does not show Save cook result in ad-hoc mode", () => {
      renderWithRouter();
      expect(screen.queryByText(/save cook result/i)).not.toBeInTheDocument();
    });

    it("shows add ingredient button in ad-hoc mode", () => {
      renderWithRouter();
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });
  });
});
