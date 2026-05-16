/**
 * AdminIngredientsTab tests
 *
 * - Initial load shows all system ingredients (no "a" bias)
 * - Debounced search fires and renders results
 * - Edit button fetches full ingredient and pre-fills form correctly
 * - Add form: validation blocks submit when fields are empty/invalid
 * - Add form: successful POST → list refreshed, success toast shown
 * - Edit form: successful PATCH → list refreshed, success toast shown
 * - Delete modal: Confirm calls DELETE and refreshes list; Cancel does not
 * - Delete: HTTP 409 response shows "ingredient in use" error toast
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AdminIngredientsTab } from "./AdminIngredientsTab";
import * as services from "../../client/services.gen";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../client/core/ApiError";
import type { IngredientDetail } from "../../client/types.gen";

jest.mock("../../client/services.gen");
jest.mock("../../hooks/useToast");

const mockToast = jest.fn();
(useToast as jest.Mock).mockReturnValue({ toast: mockToast });

const INGREDIENT_A: IngredientDetail = {
  id: 1,
  name: "Whole Milk",
  unit: "ml",
  portion_size: 100,
  kcal: 61,
  protein: 3.2,
  fat: 3.5,
  carbohydrates: 4.8,
  fiber: 0,
  sodium: 0.04,
  is_system: true,
  owner_id: null,
  icon: "🥛",
  is_promotion_pending: false,
  promotion_rejection_note: null,
};

const INGREDIENT_B: IngredientDetail = {
  id: 2,
  name: "Brown Rice",
  unit: "g",
  portion_size: 100,
  kcal: 370,
  protein: 7.9,
  fat: 2.7,
  carbohydrates: 77,
  fiber: 3.5,
  sodium: 0.01,
  is_system: true,
  owner_id: null,
  icon: "🍚",
  is_promotion_pending: false,
  promotion_rejection_note: null,
};

// Helper: resolve a 409 ApiError
function make409(): ApiError {
  return new ApiError(
    { method: "DELETE", url: "/admin/ingredients/1" },
    {
      url: "/admin/ingredients/1",
      ok: false,
      status: 409,
      statusText: "Conflict",
      body: { detail: "Ingredient is in use" },
    },
    "Conflict"
  );
}

describe("AdminIngredientsTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    // Default: list endpoint returns both ingredients
    (services.listSystemIngredientsAdminIngredientsGet as jest.Mock).mockResolvedValue([
      INGREDIENT_A,
      INGREDIENT_B,
    ]);
    // getAnyIngredient returns full record
    (
      services.getAnyIngredientAdminIngredientsIngredientIdGet as jest.Mock
    ).mockResolvedValue(INGREDIENT_A);
    // search returns search-result-shaped objects
    (services.searchIngredientsIngredientsSearchGet as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: "Whole Milk",
        unit: "ml",
        portion_size: 100,
        kcal: 61,
        is_system: true,
        icon: "🥛",
      },
    ]);
  });

  // ── Initial load ────────────────────────────────────────────────────────────

  it("loads all system ingredients on mount without a search bias", async () => {
    render(<AdminIngredientsTab />);

    await screen.findByText("Whole Milk");
    expect(screen.getByText("Brown Rice")).toBeInTheDocument();
    // Must NOT have called the biased search endpoint on first load
    expect(services.searchIngredientsIngredientsSearchGet).not.toHaveBeenCalled();
    expect(services.listSystemIngredientsAdminIngredientsGet).toHaveBeenCalled();
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  it("calls search endpoint (not list) when the user types a query", async () => {
    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    const searchInput = screen.getByPlaceholderText(/search system ingredients/i);
    fireEvent.change(searchInput, { target: { value: "milk" } });

    await waitFor(() =>
      expect(services.searchIngredientsIngredientsSearchGet).toHaveBeenCalledWith({
        q: "milk",
        limit: 50,
      })
    );
    await screen.findByText("Whole Milk");
  });

  it("switches back to the list endpoint when query is cleared", async () => {
    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    const searchInput = screen.getByPlaceholderText(/search system ingredients/i);

    fireEvent.change(searchInput, { target: { value: "milk" } });
    await waitFor(() =>
      expect(services.searchIngredientsIngredientsSearchGet).toHaveBeenCalledTimes(1)
    );

    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    (services.listSystemIngredientsAdminIngredientsGet as jest.Mock).mockResolvedValue([
      INGREDIENT_A,
      INGREDIENT_B,
    ]);

    fireEvent.change(searchInput, { target: { value: "" } });
    await waitFor(() =>
      expect(services.listSystemIngredientsAdminIngredientsGet).toHaveBeenCalled()
    );
  });

  // ── Edit: fetches full record ────────────────────────────────────────────────

  it("fetches full ingredient before opening edit form — no 'undefined' fields", async () => {
    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    const editBtns = screen.getAllByRole("button", { name: "Edit" });
    fireEvent.click(editBtns[0]);

    await waitFor(() =>
      expect(
        services.getAnyIngredientAdminIngredientsIngredientIdGet
      ).toHaveBeenCalledWith({ ingredientId: INGREDIENT_A.id })
    );

    // Nutrition fields must NOT be "undefined"
    const kcalInput = await screen.findByLabelText(/calories/i);
    expect((kcalInput as HTMLInputElement).value).toBe("61");

    const proteinInput = screen.getByLabelText(/protein/i);
    expect((proteinInput as HTMLInputElement).value).toBe("3.2");
  });

  // ── Add form validation ─────────────────────────────────────────────────────

  it("Add form: blocks submit when required fields are empty", async () => {
    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));
    fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));

    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(services.createSystemIngredientAdminIngredientsPost).not.toHaveBeenCalled();
  });

  it("Add form: blocks submit when a numeric field is negative", async () => {
    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));

    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Test Ingredient" },
    });
    fireEvent.change(screen.getByLabelText(/calories/i), {
      target: { value: "-5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));

    const errors = await screen.findAllByText("Required, ≥ 0");
    expect(errors.length).toBeGreaterThan(0);
    expect(services.createSystemIngredientAdminIngredientsPost).not.toHaveBeenCalled();
  });

  // ── Add form: successful POST ───────────────────────────────────────────────

  it("Add form: successful POST refreshes list and shows success toast", async () => {
    const NEW_INGREDIENT: IngredientDetail = {
      ...INGREDIENT_A,
      id: 3,
      name: "Almond Milk",
    };
    (
      services.createSystemIngredientAdminIngredientsPost as jest.Mock
    ).mockResolvedValue(NEW_INGREDIENT);
    (services.listSystemIngredientsAdminIngredientsGet as jest.Mock)
      .mockResolvedValueOnce([INGREDIENT_A, INGREDIENT_B])
      .mockResolvedValueOnce([INGREDIENT_A, INGREDIENT_B, NEW_INGREDIENT]);

    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    fireEvent.click(screen.getByRole("button", { name: /add ingredient/i }));

    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Almond Milk" },
    });
    for (const label of [
      /calories/i,
      /protein/i,
      /fat/i,
      /carbohydrates/i,
      /fiber/i,
      /sodium/i,
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: "1" } });
    }

    fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));

    await waitFor(() =>
      expect(services.createSystemIngredientAdminIngredientsPost).toHaveBeenCalled()
    );
    await screen.findByText("Almond Milk");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  // ── Edit form: successful PATCH ─────────────────────────────────────────────

  it("Edit form: successful PATCH refreshes list and shows success toast", async () => {
    const UPDATED: IngredientDetail = { ...INGREDIENT_A, name: "Semi-Skimmed Milk" };
    (
      services.updateAnyIngredientAdminIngredientsIngredientIdPatch as jest.Mock
    ).mockResolvedValue(UPDATED);
    (services.listSystemIngredientsAdminIngredientsGet as jest.Mock)
      .mockResolvedValueOnce([INGREDIENT_A, INGREDIENT_B])
      .mockResolvedValueOnce([UPDATED, INGREDIENT_B]);

    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    await screen.findByLabelText("Name *");

    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Semi-Skimmed Milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(
        services.updateAnyIngredientAdminIngredientsIngredientIdPatch
      ).toHaveBeenCalledWith({
        ingredientId: INGREDIENT_A.id,
        requestBody: expect.objectContaining({ name: "Semi-Skimmed Milk" }),
      })
    );
    await screen.findByText("Semi-Skimmed Milk");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  // ── Delete modal ────────────────────────────────────────────────────────────

  it("Delete modal: Cancel does not call DELETE", async () => {
    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      services.deleteAnyIngredientAdminIngredientsIngredientIdDelete
    ).not.toHaveBeenCalled();
  });

  it("Delete modal: Confirm calls DELETE and refreshes list", async () => {
    (
      services.deleteAnyIngredientAdminIngredientsIngredientIdDelete as jest.Mock
    ).mockResolvedValue(undefined);
    (services.listSystemIngredientsAdminIngredientsGet as jest.Mock)
      .mockResolvedValueOnce([INGREDIENT_A, INGREDIENT_B])
      .mockResolvedValueOnce([INGREDIENT_B]);

    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    await waitFor(() =>
      expect(
        services.deleteAnyIngredientAdminIngredientsIngredientIdDelete
      ).toHaveBeenCalledWith({ ingredientId: INGREDIENT_A.id })
    );
    await waitFor(() =>
      expect(screen.queryByText("Whole Milk")).not.toBeInTheDocument()
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  // ── Delete 409 ──────────────────────────────────────────────────────────────

  it("Delete: HTTP 409 shows 'ingredient in use' error toast", async () => {
    (
      services.deleteAnyIngredientAdminIngredientsIngredientIdDelete as jest.Mock
    ).mockRejectedValue(make409());

    render(<AdminIngredientsTab />);
    await screen.findByText("Whole Milk");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/cannot delete/i),
          variant: "destructive",
        })
      )
    );
    // Row must still be present
    expect(screen.getByText("Whole Milk")).toBeInTheDocument();
  });
});
