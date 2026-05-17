/**
 * RecipeDetailPage tests
 *
 * Covers:
 * - Loads recipe detail from GET /recipes/:id
 * - Shows ingredient list in display order with amounts
 * - Shows last cooked panel only when last_cooked_at is set
 * - No per-100g nutrition panel
 * - "Start Cooking" button present (placeholder link)
 * - "Edit Recipe" button navigates to edit form
 * - Error state when recipe not found
 * - Loading state
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RecipeDetailPage } from "./RecipeDetailPage";
import { getRecipeRecipesRecipeIdGet } from "../client/services.gen";
import { ApiError } from "../client/core/ApiError";
import type { RecipeDetail, UnitType } from "../client/types.gen";

jest.mock("../client/services.gen");

const mockGet = getRecipeRecipesRecipeIdGet as jest.MockedFunction<
  typeof getRecipeRecipesRecipeIdGet
>;

function makeIngredient(
  id: number,
  name: string,
  unit: UnitType = "g",
  amount = 100,
  display_order = 0
) {
  return {
    id,
    ingredient_id: id + 100,
    amount,
    display_order,
    ingredient: {
      id: id + 100,
      name,
      unit,
      portion_size: 100,
      kcal: 100,
      protein: 10,
      fat: 5,
      carbohydrates: 20,
      fiber: 2,
      sodium: 50,
      is_system: true,
      owner_id: null,
      icon: null,
      is_promotion_pending: false,
      promotion_rejection_note: null,
    },
  };
}

function makeRecipeDetail(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 1,
    owner_id: 42,
    name: "Chicken & Rice Bowl",
    description: "A balanced meal with lean protein.",
    last_cooked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    last_cooked_weight_g: 640,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ingredients: [
      makeIngredient(1, "Chicken Breast, raw", "g", 600, 0),
      makeIngredient(2, "Basmati Rice, dry", "g", 200, 1),
    ],
    ...overrides,
  };
}

function renderPage(id = "1") {
  return render(
    <MemoryRouter initialEntries={[`/recipes/${id}`]}>
      <Routes>
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="/recipes/:id/edit" element={<div>Edit Form</div>} />
        <Route path="/recipes/:id/cook" element={<div>Cooking Mode</div>} />
        <Route path="/recipes" element={<div>Recipe List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RecipeDetailPage — loading", () => {
  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}) as never);
    renderPage();
    // The spinner div is visible during loading
    expect(document.querySelector(".border-primary")).toBeTruthy();
  });
});

describe("RecipeDetailPage — content", () => {
  it("renders the recipe name", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    // name appears in both header and hero — check heading level 2 (hero)
    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "Chicken & Rice Bowl",
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders the recipe description", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    expect(await screen.findByText(/balanced meal/i)).toBeInTheDocument();
  });

  it("renders ingredient names in display order", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    expect(await screen.findByText("Chicken Breast, raw")).toBeInTheDocument();
    expect(screen.getByText("Basmati Rice, dry")).toBeInTheDocument();
  });

  it("renders ingredient amounts and units", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    expect(await screen.findByText("600 g")).toBeInTheDocument();
    expect(screen.getByText("200 g")).toBeInTheDocument();
  });

  it("shows last cooked panel when last_cooked_at is set", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail({ last_cooked_weight_g: 800 }));
    renderPage();
    expect(await screen.findByText(/800g cooked/i)).toBeInTheDocument();
  });

  it("does NOT show last cooked panel when recipe has never been cooked", async () => {
    mockGet.mockResolvedValue(
      makeRecipeDetail({ last_cooked_at: null, last_cooked_weight_g: null })
    );
    renderPage();
    await screen.findByRole("heading", { level: 2 });
    expect(screen.queryByText(/last cook/i)).not.toBeInTheDocument();
  });

  it("does NOT show per-100g nutrition panel", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    await screen.findByRole("heading", { level: 2 });
    expect(screen.queryByText(/per 100g/i)).not.toBeInTheDocument();
  });

  it("shows ingredient count in section header", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    // Section count badge shows "2"
    const counts = await screen.findAllByText("2");
    expect(counts.length).toBeGreaterThan(0);
  });
});

describe("RecipeDetailPage — navigation", () => {
  it("back button navigates to /recipes", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    await screen.findByRole("heading", { level: 2 });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(await screen.findByText("Recipe List")).toBeInTheDocument();
  });

  it("Edit Recipe button navigates to edit form", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    await screen.findByRole("heading", { level: 2 });

    fireEvent.click(screen.getByRole("button", { name: /edit recipe/i }));
    expect(await screen.findByText("Edit Form")).toBeInTheDocument();
  });

  it("Start Cooking Mode button is present", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    expect(
      await screen.findByRole("button", { name: /start cooking mode/i })
    ).toBeInTheDocument();
  });

  it("Start Cooking Mode button navigates to cooking route (placeholder)", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start cooking mode/i }));
    expect(await screen.findByText("Cooking Mode")).toBeInTheDocument();
  });

  it("header edit icon navigates to edit form", async () => {
    mockGet.mockResolvedValue(makeRecipeDetail());
    renderPage();
    await screen.findByRole("heading", { level: 2 });

    // There are 2 edit buttons: header icon + bottom action button
    const editBtns = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editBtns[0]);
    expect(await screen.findByText("Edit Form")).toBeInTheDocument();
  });
});

describe("RecipeDetailPage — error state", () => {
  it("shows error message when recipe not found", async () => {
    mockGet.mockRejectedValue(
      new ApiError(
        { method: "GET", url: "/recipes/999" },
        {
          url: "/recipes/999",
          ok: false,
          status: 404,
          statusText: "Not Found",
          body: {},
        },
        "Not Found"
      )
    );
    renderPage("999");
    expect(await screen.findByText(/recipe not found/i)).toBeInTheDocument();
  });
});
