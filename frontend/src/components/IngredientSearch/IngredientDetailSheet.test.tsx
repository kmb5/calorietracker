/**
 * IngredientDetailSheet tests
 *
 * Covers:
 * - Renders nutrition fields for a system ingredient
 * - Custom ingredient: shows Edit and Submit for review buttons
 * - System ingredient: does NOT show Edit / Submit for review buttons
 * - Submit for review: calls promote API, shows toast, button becomes "Pending review"
 * - Already-pending: button shows "Pending review" and is disabled
 * - Edit button: navigates to /ingredients/:id/edit
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { IngredientDetail } from "../../client/types.gen";
import { IngredientDetailSheet } from "./IngredientDetailSheet";

// ── Mock API ──────────────────────────────────────────────────────────────────
jest.mock("../../client/services.gen", () => ({
  promoteIngredientIngredientsIngredientIdPromotePost: jest.fn(),
}));

import { promoteIngredientIngredientsIngredientIdPromotePost } from "../../client/services.gen";

const mockPromote =
  promoteIngredientIngredientsIngredientIdPromotePost as jest.MockedFunction<
    typeof promoteIngredientIngredientsIngredientIdPromotePost
  >;

// ── Mock toast ────────────────────────────────────────────────────────────────
const mockToast = jest.fn();
jest.mock("../../hooks/useToast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Mock navigate ─────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SYSTEM_DETAIL: IngredientDetail = {
  id: 1,
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
  icon: null,
  is_promotion_pending: false,
};

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
};

const PENDING_CUSTOM_DETAIL: IngredientDetail = {
  ...CUSTOM_DETAIL,
  is_promotion_pending: true,
};

// ── Helper ────────────────────────────────────────────────────────────────────
function renderSheet(
  props: Partial<React.ComponentProps<typeof IngredientDetailSheet>> = {}
) {
  return render(
    <MemoryRouter>
      <IngredientDetailSheet
        detail={null}
        isLoading={false}
        open={false}
        onClose={jest.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

describe("IngredientDetailSheet — system ingredient", () => {
  it("renders all 6 nutrition fields", () => {
    renderSheet({ detail: SYSTEM_DETAIL, open: true });
    expect(screen.getByText("Protein")).toBeInTheDocument();
    expect(screen.getByText("Fat")).toBeInTheDocument();
    expect(screen.getByText("Carbohydrates")).toBeInTheDocument();
    expect(screen.getByText("Fiber")).toBeInTheDocument();
    expect(screen.getByText("Sodium")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
  });

  it("does NOT show Edit or Submit for review for system ingredients", () => {
    renderSheet({ detail: SYSTEM_DETAIL, open: true });
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit for review/i })
    ).not.toBeInTheDocument();
  });
});

describe("IngredientDetailSheet — custom ingredient", () => {
  it("shows Edit and Submit for review buttons", () => {
    renderSheet({ detail: CUSTOM_DETAIL, open: true });
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeInTheDocument();
  });

  it("Edit button navigates to /ingredients/:id/edit", () => {
    const onClose = jest.fn();
    renderSheet({ detail: CUSTOM_DETAIL, open: true, onClose });

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(`/ingredients/${CUSTOM_DETAIL.id}/edit`);
  });

  it("calls promote API and shows success toast", async () => {
    mockPromote.mockResolvedValue({ ...CUSTOM_DETAIL, is_promotion_pending: true });
    const onPromoted = jest.fn();
    renderSheet({ detail: CUSTOM_DETAIL, open: true, onPromoted });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    });

    await waitFor(() => expect(mockPromote).toHaveBeenCalledWith({ ingredientId: 42 }));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
    expect(onPromoted).toHaveBeenCalled();
  });

  it("button becomes 'Pending review' and is disabled after submission", async () => {
    mockPromote.mockResolvedValue({ ...CUSTOM_DETAIL, is_promotion_pending: true });
    renderSheet({ detail: CUSTOM_DETAIL, open: true });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /pending review/i })).toBeDisabled()
    );
  });

  it("shows error toast when promote fails", async () => {
    mockPromote.mockRejectedValue(new Error("500"));
    renderSheet({ detail: CUSTOM_DETAIL, open: true });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      )
    );
    // Button should still be active (not disabled) since it failed
    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeInTheDocument();
  });

  it("shows 'Pending review' (disabled) when is_promotion_pending is true on load", () => {
    renderSheet({ detail: PENDING_CUSTOM_DETAIL, open: true });
    const btn = screen.getByRole("button", { name: /pending review/i });
    expect(btn).toBeDisabled();
  });
});

describe("IngredientDetailSheet — loading state", () => {
  it("shows pulse skeletons while loading", () => {
    renderSheet({ detail: null, isLoading: true, open: true });
    // The name skeleton is rendered as a block element with animate-pulse
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
