/**
 * CustomIngredientFormPage tests
 *
 * Covers:
 * - Create form: renders all fields, validates required fields on submit,
 *   calls POST API on valid submit, navigates away on success, shows error toast on failure
 * - Edit form: fetches ingredient by id, pre-fills fields, calls PATCH on save
 * - Delete: shows confirmation dialog, calls DELETE on confirm, navigates away
 * - Name pre-fill from router state (passed by IngredientSearch CTA)
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { IngredientDetail } from "../client/types.gen";
import { CustomIngredientFormPage } from "./CustomIngredientFormPage";

// ── Mock API client ───────────────────────────────────────────────────────────
jest.mock("../client/services.gen", () => ({
  createIngredientIngredientsPost: jest.fn(),
  getIngredientIngredientsIngredientIdGet: jest.fn(),
  updateIngredientIngredientsIngredientIdPatch: jest.fn(),
  deleteIngredientIngredientsIngredientIdDelete: jest.fn(),
}));

// ── Mock toast ────────────────────────────────────────────────────────────────
const mockToast = jest.fn();
jest.mock("../hooks/useToast", () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import {
  createIngredientIngredientsPost,
  getIngredientIngredientsIngredientIdGet,
  updateIngredientIngredientsIngredientIdPatch,
  deleteIngredientIngredientsIngredientIdDelete,
} from "../client/services.gen";

const mockCreate = createIngredientIngredientsPost as jest.MockedFunction<
  typeof createIngredientIngredientsPost
>;
const mockGetDetail = getIngredientIngredientsIngredientIdGet as jest.MockedFunction<
  typeof getIngredientIngredientsIngredientIdGet
>;
const mockUpdate = updateIngredientIngredientsIngredientIdPatch as jest.MockedFunction<
  typeof updateIngredientIngredientsIngredientIdPatch
>;
const mockDelete = deleteIngredientIngredientsIngredientIdDelete as jest.MockedFunction<
  typeof deleteIngredientIngredientsIngredientIdDelete
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const CUSTOM_DETAIL: IngredientDetail = {
  id: 42,
  name: "My Sauce",
  unit: "tablespoon",
  portion_size: 15,
  kcal: 60,
  protein: 1,
  fat: 5,
  carbohydrates: 3,
  fiber: 0.5,
  sodium: 120,
  is_system: false,
  owner_id: 1,
  icon: "🫙",
  is_promotion_pending: false,
  promotion_rejection_note: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderCreate(initialState?: { name?: string }) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/ingredients/new", state: initialState }]}
    >
      <Routes>
        <Route path="/ingredients/new" element={<CustomIngredientFormPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEdit(id = 42) {
  return render(
    <MemoryRouter initialEntries={[`/ingredients/${id}/edit`]}>
      <Routes>
        <Route path="/ingredients/:id/edit" element={<CustomIngredientFormPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// Fill all required nutrition fields
function fillNutrition() {
  fireEvent.change(screen.getByLabelText(/calories/i), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText(/protein/i), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/fat/i), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText(/carbohydrates/i), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText(/fiber/i), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText(/sodium/i), { target: { value: "50" } });
}

// ── Tests ──────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

describe("CustomIngredientFormPage — create form", () => {
  it("renders the create heading", () => {
    renderCreate();
    expect(screen.getByText("New Ingredient")).toBeInTheDocument();
  });

  it("pre-fills name from router state", () => {
    renderCreate({ name: "Oat milk" });
    const nameInput = screen.getByLabelText(/name/i);
    expect(nameInput).toHaveValue("Oat milk");
  });

  it("shows validation errors when submitting an empty form", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));
    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
    // Also check a nutrition field error
    expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0);
  });

  it("calls POST API with correct payload on valid submit", async () => {
    mockCreate.mockResolvedValue({ ...CUSTOM_DETAIL, id: 99 });
    renderCreate();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Oat Milk" } });
    fillNutrition();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));
    });

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({
        name: "Oat Milk",
        kcal: 100,
        protein: 10,
      }),
    });
  });

  it("shows success toast and navigates home after create", async () => {
    mockCreate.mockResolvedValue({ ...CUSTOM_DETAIL, id: 99 });
    renderCreate();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "New Food" } });
    fillNutrition();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" })
      )
    );
    await waitFor(() => screen.getByText("Home"));
  });

  it("shows error toast when POST fails", async () => {
    mockCreate.mockRejectedValue(new Error("500"));
    renderCreate();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "New Food" } });
    fillNutrition();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      )
    );
  });

  it("does not call POST when name is missing", async () => {
    renderCreate();
    fillNutrition();
    fireEvent.click(screen.getByRole("button", { name: /create ingredient/i }));
    await waitFor(() =>
      expect(screen.getByText("Name is required")).toBeInTheDocument()
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("CustomIngredientFormPage — edit form", () => {
  it("shows loading state then pre-fills form fields", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    renderEdit();

    // Should eventually pre-fill
    await waitFor(() => {
      expect(screen.getByDisplayValue("My Sauce")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("15")).toBeInTheDocument(); // portion_size
    expect(screen.getByDisplayValue("60")).toBeInTheDocument(); // kcal
  });

  it("renders 'Edit Ingredient' heading", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    renderEdit();
    await waitFor(() => screen.getByText("Edit Ingredient"));
  });

  it("calls PATCH with updated values on save", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    mockUpdate.mockResolvedValue({ ...CUSTOM_DETAIL, name: "Updated Sauce" });
    renderEdit();

    await waitFor(() => screen.getByDisplayValue("My Sauce"));

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Updated Sauce" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredientId: 42,
        requestBody: expect.objectContaining({ name: "Updated Sauce" }),
      })
    );
  });

  it("shows success toast and navigates home after edit", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    mockUpdate.mockResolvedValue(CUSTOM_DETAIL);
    renderEdit();

    await waitFor(() => screen.getByDisplayValue("My Sauce"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" })
      )
    );
    await waitFor(() => screen.getByText("Home"));
  });

  it("navigates home and shows error toast when ingredient not found", async () => {
    mockGetDetail.mockRejectedValue(new Error("404"));
    renderEdit();

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      )
    );
    await waitFor(() => screen.getByText("Home"));
  });
});

describe("CustomIngredientFormPage — delete flow", () => {
  it("shows delete button in edit mode", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    renderEdit();
    await waitFor(() => screen.getByLabelText("Delete ingredient"));
  });

  it("opens confirmation dialog on delete button click", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    renderEdit();
    await waitFor(() => screen.getByLabelText("Delete ingredient"));

    fireEvent.click(screen.getByLabelText("Delete ingredient"));

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());
    expect(screen.getByText("Delete ingredient?")).toBeInTheDocument();
  });

  it("dismisses dialog on Cancel", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    renderEdit();
    await waitFor(() => screen.getByLabelText("Delete ingredient"));

    fireEvent.click(screen.getByLabelText("Delete ingredient"));
    await waitFor(() => screen.getByRole("alertdialog"));

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
  });

  it("calls DELETE and navigates home on confirm", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    mockDelete.mockResolvedValue(undefined);
    renderEdit();
    await waitFor(() => screen.getByLabelText("Delete ingredient"));

    fireEvent.click(screen.getByLabelText("Delete ingredient"));
    await waitFor(() => screen.getByRole("alertdialog"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    });

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ ingredientId: 42 }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" })
      )
    );
    await waitFor(() => screen.getByText("Home"));
  });

  it("does not hide dialog on failed delete", async () => {
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    mockDelete.mockRejectedValue(new Error("500"));
    renderEdit();
    await waitFor(() => screen.getByLabelText("Delete ingredient"));

    fireEvent.click(screen.getByLabelText("Delete ingredient"));
    await waitFor(() => screen.getByRole("alertdialog"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      )
    );
    // Dialog stays open after failure
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
