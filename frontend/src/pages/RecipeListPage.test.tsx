/**
 * RecipeListPage tests
 *
 * Covers:
 * - Loads recipes from GET /recipes and renders cards
 * - Search bar filters visible recipes
 * - FAB navigates to create route
 * - Delete (via delete button) removes card optimistically + shows undo toast
 * - Empty state renders when no recipes exist
 * - Error state renders on API failure
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RecipeListPage } from "./RecipeListPage";
import { deleteRecipeRecipesRecipeIdDelete,
  listRecipesRecipesGet,
} from "../client/services.gen";
import { useToast } from "../hooks/useToast";

jest.mock("../client/services.gen");
jest.mock("../hooks/useToast");

const mockList = listRecipesRecipesGet as jest.MockedFunction<typeof listRecipesRecipesGet>;
const mockDelete = deleteRecipeRecipesRecipeIdDelete as jest.MockedFunction<
  typeof deleteRecipeRecipesRecipeIdDelete
>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

const mockToast = jest.fn();

function makeRecipe(overrides = {}) {
  return {
    id: 1,
    name: "Chicken & Rice Bowl",
    description: "A tasty recipe",
    last_cooked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    last_cooked_weight_g: 640,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/recipes"]}>
      <Routes>
        <Route path="/recipes" element={<RecipeListPage />} />
        <Route path="/recipes/new" element={<div>New Recipe</div>} />
        <Route path="/recipes/:id" element={<div>Recipe Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseToast.mockReturnValue({ toast: mockToast });
  // Return a resolved promise by default
  mockList.mockResolvedValue([]);
  mockDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("RecipeListPage — loading", () => {
  it("shows a loading spinner initially", () => {
    mockList.mockReturnValue(new Promise(() => {}) as never); // never resolves
    renderPage();
    expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument();
  });
});

describe("RecipeListPage — empty state", () => {
  it("shows empty state when no recipes exist", async () => {
    mockList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/no recipes yet/i)).toBeInTheDocument();
  });

  it("shows CTA button in empty state", async () => {
    mockList.mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByRole("button", { name: /create your first recipe/i })
    ).toBeInTheDocument();
  });

  it("CTA navigates to /recipes/new", async () => {
    mockList.mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /create your first recipe/i }));
    expect(await screen.findByText("New Recipe")).toBeInTheDocument();
  });
});

describe("RecipeListPage — recipe cards", () => {
  it("renders recipe names", async () => {
    mockList.mockResolvedValue([
      makeRecipe({ id: 1, name: "Chicken & Rice Bowl" }),
      makeRecipe({ id: 2, name: "Red Lentil Soup", last_cooked_at: null }),
    ]);
    renderPage();
    expect(await screen.findByText("Chicken & Rice Bowl")).toBeInTheDocument();
    expect(screen.getByText("Red Lentil Soup")).toBeInTheDocument();
  });

  it("shows 'Never cooked' for recipes with no last_cooked_at", async () => {
    mockList.mockResolvedValue([
      makeRecipe({ id: 1, name: "Beef Stir-fry", last_cooked_at: null }),
    ]);
    renderPage();
    expect(await screen.findByText(/never cooked/i)).toBeInTheDocument();
  });

  it("shows recipe count", async () => {
    mockList.mockResolvedValue([
      makeRecipe({ id: 1, name: "A" }),
      makeRecipe({ id: 2, name: "B" }),
    ]);
    renderPage();
    expect(await screen.findByText("2 recipes")).toBeInTheDocument();
  });

  it("clicking a card navigates to detail page", async () => {
    mockList.mockResolvedValue([makeRecipe({ id: 42, name: "Pasta" })]);
    renderPage();
    const card = await screen.findByRole("button", { name: /view pasta/i });
    fireEvent.click(card);
    expect(await screen.findByText("Recipe Detail")).toBeInTheDocument();
  });
});

describe("RecipeListPage — search", () => {
  it("filters recipes by name", async () => {
    mockList.mockResolvedValue([
      makeRecipe({ id: 1, name: "Chicken & Rice Bowl" }),
      makeRecipe({ id: 2, name: "Red Lentil Soup" }),
    ]);
    renderPage();
    await screen.findByText("Chicken & Rice Bowl");

    await userEvent.type(screen.getByRole("textbox", { name: /search recipes/i }), "lentil");
    expect(screen.queryByText("Chicken & Rice Bowl")).not.toBeInTheDocument();
    expect(screen.getByText("Red Lentil Soup")).toBeInTheDocument();
  });

  it("shows 'no recipes matching' empty state when search has no results", async () => {
    mockList.mockResolvedValue([makeRecipe({ id: 1, name: "Pasta" })]);
    renderPage();
    await screen.findByText("Pasta");

    await userEvent.type(screen.getByRole("textbox", { name: /search recipes/i }), "zzz");
    expect(await screen.findByText(/no recipes matching/i)).toBeInTheDocument();
  });
});

describe("RecipeListPage — FAB", () => {
  it("FAB is visible and navigates to create route", async () => {
    mockList.mockResolvedValue([]);
    renderPage();
    await screen.findByText(/no recipes yet/i);

    fireEvent.click(screen.getByRole("button", { name: /new recipe/i }));
    expect(await screen.findByText("New Recipe")).toBeInTheDocument();
  });
});

describe("RecipeListPage — delete with undo", () => {
  it("removes card immediately on delete", async () => {
    jest.useFakeTimers();
    mockList.mockResolvedValue([makeRecipe({ id: 7, name: "Pasta Bolognese" })]);
    renderPage();
    await screen.findByText("Pasta Bolognese");

    // Click the delete button
    fireEvent.click(screen.getByRole("button", { name: /delete pasta bolognese/i }));
    expect(screen.queryByText("Pasta Bolognese")).not.toBeInTheDocument();
  });

  it("calls the API after 5 seconds", async () => {
    jest.useFakeTimers();
    mockList.mockResolvedValue([makeRecipe({ id: 7, name: "Pasta Bolognese" })]);
    renderPage();
    await screen.findByText("Pasta Bolognese");

    fireEvent.click(screen.getByRole("button", { name: /delete pasta bolognese/i }));
    expect(mockDelete).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith({ recipeId: 7 })
    );
  });

  it("shows an undo toast after delete", async () => {
    jest.useFakeTimers();
    mockList.mockResolvedValue([makeRecipe({ id: 7, name: "Pasta Bolognese" })]);
    renderPage();
    await screen.findByText("Pasta Bolognese");

    fireEvent.click(screen.getByRole("button", { name: /delete pasta bolognese/i }));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Recipe deleted" })
    );
  });
});

describe("RecipeListPage — error state", () => {
  it("shows error message on API failure", async () => {
    mockList.mockRejectedValue(new Error("Network error"));
    renderPage();
    expect(await screen.findByText(/failed to load recipes/i)).toBeInTheDocument();
  });
});
