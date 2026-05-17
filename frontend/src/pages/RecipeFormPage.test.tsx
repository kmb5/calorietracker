/**
 * RecipeFormPage tests
 *
 * Covers:
 * - Create form: renders fields, validates required name, validates at least 1 ingredient,
 *   calls POST on valid submit, navigates to recipe detail on success, shows error on failure
 * - Edit form: fetches recipe by id, pre-fills name/description, calls PATCH on save,
 *   returns to detail on success
 * - Delete: shows confirmation dialog, calls DELETE on confirm, navigates to recipe list
 * - Duplicate: calls POST /duplicate, navigates to new recipe's edit view
 * - Ingredient rows: add row, remove row, amount validation
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { RecipeDetail, IngredientSearchResult } from "../client/types.gen";
import { RecipeFormPage } from "./RecipeFormPage";

// ── Mock services ─────────────────────────────────────────────────────────────
jest.mock("../client/services.gen", () => ({
  createRecipeRecipesPost: jest.fn(),
  getRecipeRecipesRecipeIdGet: jest.fn(),
  updateRecipeRecipesRecipeIdPatch: jest.fn(),
  deleteRecipeRecipesRecipeIdDelete: jest.fn(),
  duplicateRecipeRecipesRecipeIdDuplicatePost: jest.fn(),
  searchIngredientsIngredientsSearchGet: jest.fn(),
  getIngredientIngredientsIngredientIdGet: jest.fn(),
}));

// ── Mock toast ────────────────────────────────────────────────────────────────
const mockToast = jest.fn();
jest.mock("../hooks/useToast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import {
  createRecipeRecipesPost,
  getRecipeRecipesRecipeIdGet,
  updateRecipeRecipesRecipeIdPatch,
  deleteRecipeRecipesRecipeIdDelete,
  duplicateRecipeRecipesRecipeIdDuplicatePost,
  searchIngredientsIngredientsSearchGet,
} from "../client/services.gen";

const mockCreate = createRecipeRecipesPost as jest.MockedFunction<
  typeof createRecipeRecipesPost
>;
const mockGetRecipe = getRecipeRecipesRecipeIdGet as jest.MockedFunction<
  typeof getRecipeRecipesRecipeIdGet
>;
const mockUpdate = updateRecipeRecipesRecipeIdPatch as jest.MockedFunction<
  typeof updateRecipeRecipesRecipeIdPatch
>;
const mockDelete = deleteRecipeRecipesRecipeIdDelete as jest.MockedFunction<
  typeof deleteRecipeRecipesRecipeIdDelete
>;
const mockDuplicate =
  duplicateRecipeRecipesRecipeIdDuplicatePost as jest.MockedFunction<
    typeof duplicateRecipeRecipesRecipeIdDuplicatePost
  >;
const mockSearch = searchIngredientsIngredientsSearchGet as jest.MockedFunction<
  typeof searchIngredientsIngredientsSearchGet
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SEARCH_RESULT: IngredientSearchResult = {
  id: 101,
  name: "Chicken Breast",
  unit: "g",
  portion_size: 100,
  kcal: 165,
  is_system: true,
  icon: "🍗",
};

const RECIPE_DETAIL: RecipeDetail = {
  id: 7,
  owner_id: 1,
  name: "Chicken & Rice",
  description: "A tasty dish",
  last_cooked_at: null,
  last_cooked_weight_g: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ingredients: [
    {
      id: 1,
      ingredient_id: 101,
      amount: 300,
      display_order: 0,
      ingredient: {
        id: 101,
        name: "Chicken Breast",
        unit: "g",
        portion_size: 100,
        kcal: 165,
        protein: 31,
        fat: 3.6,
        carbohydrates: 0,
        fiber: 0,
        sodium: 74,
        is_system: true,
        owner_id: null,
        icon: "🍗",
        is_promotion_pending: false,
        promotion_rejection_note: null,
      },
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/recipes/new"]}>
      <Routes>
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/recipes/:id" element={<div>Recipe Detail</div>} />
        <Route path="/recipes" element={<div>Recipe List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEdit(id: number) {
  return render(
    <MemoryRouter initialEntries={[`/recipes/${id}/edit`]}>
      <Routes>
        <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
        <Route path="/recipes/:id" element={<div>Recipe Detail</div>} />
        <Route path="/recipes" element={<div>Recipe List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE FORM
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipeFormPage – create", () => {
  it("renders the create form with name, description, and empty ingredient list", () => {
    renderCreate();
    expect(screen.getByText("New Recipe")).toBeInTheDocument();
    expect(screen.getByLabelText(/recipe name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add ingredient/i })).toBeInTheDocument();
  });

  it("shows name validation error when submitting with no name", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /save recipe/i }));
    await waitFor(() => {
      expect(screen.getByText(/recipe name is required/i)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows ingredient validation error when submitting with no ingredients", async () => {
    renderCreate();
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save recipe/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/at least one ingredient is required/i)
      ).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("adds an empty ingredient row when clicking 'Add ingredient'", async () => {
    renderCreate();
    const addBtn = screen.getByRole("button", { name: /add ingredient/i });
    fireEvent.click(addBtn);
    // Should now show a search input for the new row
    expect(screen.getByPlaceholderText(/search ingredient/i)).toBeInTheDocument();
  });

  it("removes an ingredient row when clicking the remove button", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));
    const removeBtn = screen.getByRole("button", { name: /remove ingredient/i });
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);
    expect(screen.queryByPlaceholderText(/search ingredient/i)).not.toBeInTheDocument();
  });

  it("calls POST /recipes with correct payload and navigates to detail on success", async () => {
    mockSearch.mockResolvedValue([SEARCH_RESULT]);
    mockCreate.mockResolvedValue(RECIPE_DETAIL);

    renderCreate();

    // Fill name
    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "Chicken & Rice" },
    });

    // Add an ingredient row and select an ingredient
    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));
    const searchInput = screen.getByPlaceholderText(/search ingredient/i);
    fireEvent.change(searchInput, { target: { value: "Chicken" } });

    // Wait for search results
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /chicken breast/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: /chicken breast/i }));

    // Set amount
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "300" } });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save recipe/i }));
    });

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        requestBody: expect.objectContaining({
          name: "Chicken & Rice",
          ingredients: expect.arrayContaining([
            expect.objectContaining({
              ingredient_id: 101,
              amount: 300,
            }),
          ]),
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Recipe Detail")).toBeInTheDocument();
    });
  });

  it("shows error toast when POST /recipes fails", async () => {
    mockSearch.mockResolvedValue([SEARCH_RESULT]);
    const { ApiError } = jest.requireActual("../client/core/ApiError");
    mockCreate.mockRejectedValue(
      new ApiError(
        { method: "POST", url: "/recipes" },
        {
          url: "/recipes",
          ok: false,
          status: 400,
          statusText: "Bad Request",
          body: { detail: "Invalid data" },
        },
        "Bad Request"
      )
    );

    renderCreate();

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));
    const searchInput = screen.getByPlaceholderText(/search ingredient/i);
    fireEvent.change(searchInput, { target: { value: "Chicken" } });
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /chicken breast/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: /chicken breast/i }));
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "100" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save recipe/i }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      );
    });
  });

  it("navigates back to recipe list when clicking Cancel", () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText("Recipe List")).toBeInTheDocument();
  });

  it("does not show the danger zone in create mode", () => {
    renderCreate();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete recipe/i })
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EDIT FORM
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipeFormPage – edit", () => {
  it("fetches recipe by id and pre-fills name and description", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);

    renderEdit(7);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Chicken & Rice")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("A tasty dish")).toBeInTheDocument();
  });

  it("pre-fills ingredient rows from the fetched recipe", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);

    renderEdit(7);

    await waitFor(() => {
      expect(screen.getByText("Chicken Breast")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("300")).toBeInTheDocument();
  });

  it("calls PATCH /recipes/{id} on save and returns to detail view", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);
    mockUpdate.mockResolvedValue({ ...RECIPE_DETAIL, name: "Updated Recipe" });

    renderEdit(7);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Chicken & Rice")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "Updated Recipe" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save recipe/i }));
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        recipeId: 7,
        requestBody: expect.objectContaining({
          name: "Updated Recipe",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Recipe Detail")).toBeInTheDocument();
    });
  });

  it("shows the danger zone with Delete and Duplicate buttons in edit mode", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);

    renderEdit(7);

    await waitFor(() => {
      expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /delete recipe/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
  });

  it("shows delete confirmation dialog when Delete is clicked", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);

    renderEdit(7);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /delete recipe/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /delete recipe/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/delete recipe\?/i)).toBeInTheDocument();
  });

  it("calls DELETE and navigates to recipe list on confirm delete", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);
    mockDelete.mockResolvedValue(undefined);

    renderEdit(7);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /delete recipe/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /delete recipe/i }));

    const confirmBtn = screen.getByRole("button", { name: /yes, delete/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({ recipeId: 7 });
    });
    await waitFor(() => {
      expect(screen.getByText("Recipe List")).toBeInTheDocument();
    });
  });

  it("closes delete dialog when Cancel is clicked", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);

    renderEdit(7);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /delete recipe/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /delete recipe/i }));

    const dialog = screen.getByRole("alertdialog");
    const cancelBtn = dialog.querySelector("button:last-child") as HTMLElement;
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("calls POST /duplicate and navigates to new recipe edit page", async () => {
    mockGetRecipe.mockResolvedValue(RECIPE_DETAIL);
    mockDuplicate.mockResolvedValue({ id: 99 });

    renderEdit(7);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /duplicate/i }));
    });

    await waitFor(() => {
      expect(mockDuplicate).toHaveBeenCalledWith({ recipeId: 7 });
    });
    // navigated to /recipes/99/edit
    await waitFor(() => {
      // The edit page for the new recipe should be rendered (same component)
      expect(mockGetRecipe).toHaveBeenCalledWith({ recipeId: 99 });
    });
  });

  it("shows error toast when loading the recipe fails", async () => {
    const { ApiError } = jest.requireActual("../client/core/ApiError");
    mockGetRecipe.mockRejectedValue(
      new ApiError(
        { method: "GET", url: "/recipes/7" },
        {
          url: "/recipes/7",
          ok: false,
          status: 404,
          statusText: "Not Found",
          body: { detail: "Not found" },
        },
        "Not Found"
      )
    );

    renderEdit(7);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AMOUNT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipeFormPage – amount validation", () => {
  it("rejects zero amount on submit", async () => {
    mockSearch.mockResolvedValue([SEARCH_RESULT]);
    renderCreate();

    fireEvent.change(screen.getByLabelText(/recipe name/i), {
      target: { value: "My Recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));
    const searchInput = screen.getByPlaceholderText(/search ingredient/i);
    fireEvent.change(searchInput, { target: { value: "Chicken" } });
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /chicken breast/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: /chicken breast/i }));

    // Leave amount at 0 (default)
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: "0" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save recipe/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
