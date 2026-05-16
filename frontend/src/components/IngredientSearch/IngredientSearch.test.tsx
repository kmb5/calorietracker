/**
 * IngredientSearch tests
 *
 * Covers:
 * - Idle: renders input with placeholder
 * - Typing: calls search API (debounced), shows result rows with name/kcal/unit/badge
 * - Keyboard navigation: ↑↓ highlights rows, Enter selects
 * - Selection: shows chip with name and clear button; fires onSelect callback
 * - Clear: returns to idle state
 * - No-results: shows empty state with "Create custom ingredient" link
 * - Details: opens sheet when "Details" is clicked on selected chip
 * - Loading: shows spinner during search
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { IngredientDetail, IngredientSearchResult } from "../../client/types.gen";
import { IngredientSearch } from "./IngredientSearch";

// ── Mock toast (IngredientDetailSheet now uses useToast) ────────────────────
jest.mock("../../hooks/useToast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// ── Mock the generated API client ─────────────────────────────────────────────
jest.mock("../../client/services.gen", () => ({
  searchIngredientsIngredientsSearchGet: jest.fn(),
  getIngredientIngredientsIngredientIdGet: jest.fn(),
  promoteIngredientIngredientsIngredientIdPromotePost: jest.fn(),
}));

import {
  getIngredientIngredientsIngredientIdGet,
  promoteIngredientIngredientsIngredientIdPromotePost,
  searchIngredientsIngredientsSearchGet,
} from "../../client/services.gen";

const mockSearch = searchIngredientsIngredientsSearchGet as jest.MockedFunction<
  typeof searchIngredientsIngredientsSearchGet
>;
const mockGetDetail = getIngredientIngredientsIngredientIdGet as jest.MockedFunction<
  typeof getIngredientIngredientsIngredientIdGet
>;
const mockPromote =
  promoteIngredientIngredientsIngredientIdPromotePost as jest.MockedFunction<
    typeof promoteIngredientIngredientsIngredientIdPromotePost
  >;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SYSTEM_RESULT: IngredientSearchResult = {
  id: 1,
  name: "Chicken Breast",
  unit: "g",
  portion_size: 100,
  kcal: 165,
  is_system: true,
  icon: null,
};

const CUSTOM_RESULT: IngredientSearchResult = {
  id: 2,
  name: "My Marinade",
  unit: "tablespoon",
  portion_size: 15,
  kcal: 48,
  is_system: false,
  icon: null,
};

const DETAIL: IngredientDetail = {
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
  id: 2,
  name: "My Marinade",
  unit: "tablespoon",
  portion_size: 15,
  kcal: 48,
  protein: 2,
  fat: 3,
  carbohydrates: 5,
  fiber: 0.5,
  sodium: 100,
  is_system: false,
  owner_id: 1,
  icon: null,
  is_promotion_pending: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderSearch(props: React.ComponentProps<typeof IngredientSearch> = {}) {
  return render(
    <MemoryRouter>
      <IngredientSearch {...props} />
    </MemoryRouter>
  );
}

// Simulate typing into a controlled input and advance past the 300ms debounce.
// fireEvent.change is used deliberately — userEvent.type fires per-keystroke
// timeouts that deadlock against jest.useFakeTimers().
function typeAndDebounce(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
  act(() => {
    jest.advanceTimersByTime(350);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockResolvedValue([]);
  mockGetDetail.mockResolvedValue(DETAIL);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe("IngredientSearch — idle state", () => {
  it("renders the search input with placeholder", () => {
    renderSearch();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search ingredients…")).toBeInTheDocument();
  });

  it("accepts a custom placeholder", () => {
    renderSearch({ placeholder: "Find food…" });
    expect(screen.getByPlaceholderText("Find food…")).toBeInTheDocument();
  });
});

describe("IngredientSearch — typing / results", () => {
  it("calls the search API after the debounce delay", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");

    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    expect(mockSearch).toHaveBeenCalledWith({ q: "chick" });
  });

  it("does NOT call search on every keystroke", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    // Fire multiple changes in quick succession — debounce should coalesce them
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "ch" } });
    fireEvent.change(input, { target: { value: "chi" } });
    // Only advance time halfway through the debounce window
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("renders result rows with name, kcal, unit and system badge", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");

    await waitFor(() => screen.getByText("Chicken Breast"));
    expect(screen.getByText("165 kcal")).toBeInTheDocument();
    expect(screen.getByText("per 100g")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders a custom badge for non-system ingredients", async () => {
    mockSearch.mockResolvedValue([CUSTOM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "marinade");

    await waitFor(() => screen.getByText("My Marinade"));
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
  });

  it("shows a result count header", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT, CUSTOM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "x");

    await waitFor(() => screen.getByText("2 results"));
  });
});

describe("IngredientSearch — no results state", () => {
  it("shows the empty state and CTA when search returns nothing", async () => {
    mockSearch.mockResolvedValue([]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "xylitolsauce");

    await waitFor(() => screen.getByText("No ingredients found"));
    expect(screen.getByText(/no results for/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create custom ingredient/i })
    ).toBeInTheDocument();
  });
});

describe("IngredientSearch — keyboard navigation", () => {
  it("highlights the next row on ArrowDown", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT, CUSTOM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "c");
    await waitFor(() => screen.getAllByRole("option"));

    fireEvent.keyDown(input, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  it("selects the highlighted row on Enter", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    const onSelect = jest.fn();
    renderSearch({ onSelect });
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");
    await waitFor(() => screen.getByRole("option"));

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(SYSTEM_RESULT));
  });

  it("closes the dropdown on Escape", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");
    await waitFor(() => screen.getByRole("listbox"));

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });
});

describe("IngredientSearch — selection state", () => {
  it("shows the selected chip after clicking a result row", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");
    await waitFor(() => screen.getByText("Chicken Breast"));

    fireEvent.click(screen.getByText("Chicken Breast"));

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.getByText("Chicken Breast")).toBeInTheDocument();
    });
  });

  it("fires onSelect with the selected ingredient", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    const onSelect = jest.fn();
    renderSearch({ onSelect });
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");
    await waitFor(() => screen.getByText("Chicken Breast"));

    fireEvent.click(screen.getByText("Chicken Breast"));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(SYSTEM_RESULT));
  });

  it("returns to idle when the clear button is clicked", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");
    await waitFor(() => screen.getByText("Chicken Breast"));
    fireEvent.click(screen.getByText("Chicken Breast"));
    await waitFor(() => screen.getByLabelText("Clear selection"));

    fireEvent.click(screen.getByLabelText("Clear selection"));

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
  });
});

describe("IngredientSearch — error paths", () => {
  it("shows no-results state when search API rejects", async () => {
    mockSearch.mockRejectedValue(new Error("Network error"));
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chicken");

    await waitFor(() => screen.getByText("No ingredients found"));
    // Should not be stuck in loading state
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes the detail sheet (no loading spinner) when detail fetch rejects", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    mockGetDetail.mockRejectedValue(new Error("500"));
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");
    await waitFor(() => screen.getByText("Chicken Breast"));
    fireEvent.click(screen.getByText("Chicken Breast"));
    await waitFor(() => screen.getByLabelText("View nutrition details"));

    fireEvent.click(screen.getByLabelText("View nutrition details"));

    await waitFor(() =>
      expect(mockGetDetail).toHaveBeenCalledWith({ ingredientId: 1 })
    );
    // Sheet should not hang in loading state — detail is null so sheet closes
    await waitFor(() =>
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    );
  });
});

describe("IngredientSearch — detail sheet", () => {
  it("opens the detail sheet and shows all 6 nutrition fields", async () => {
    mockSearch.mockResolvedValue([SYSTEM_RESULT]);
    mockGetDetail.mockResolvedValue(DETAIL);
    renderSearch();
    const input = screen.getByRole("combobox");

    typeAndDebounce(input, "chick");
    await waitFor(() => screen.getByText("Chicken Breast"));
    fireEvent.click(screen.getByText("Chicken Breast"));
    await waitFor(() => screen.getByLabelText("View nutrition details"));

    fireEvent.click(screen.getByLabelText("View nutrition details"));

    await waitFor(() =>
      expect(mockGetDetail).toHaveBeenCalledWith({ ingredientId: 1 })
    );
    // Wait for a data-specific value that only appears after the API resolves
    await waitFor(() => screen.getByText("Protein"));
    expect(screen.getByText("Fat")).toBeInTheDocument();
    expect(screen.getByText("Carbohydrates")).toBeInTheDocument();
    expect(screen.getByText("Fiber")).toBeInTheDocument();
    expect(screen.getByText("Sodium")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
  });
});

describe("IngredientSearch — post-promotion state", () => {
  it("shows 'Pending review' after a successful promote without a second GET", async () => {
    // Custom ingredient that can be promoted
    mockSearch.mockResolvedValue([CUSTOM_RESULT]);
    mockGetDetail.mockResolvedValue(CUSTOM_DETAIL);
    // Promote API returns the updated ingredient with is_promotion_pending=true
    const updatedDetail: IngredientDetail = {
      ...CUSTOM_DETAIL,
      is_promotion_pending: true,
    };
    mockPromote.mockResolvedValue(updatedDetail);

    renderSearch();
    const input = screen.getByRole("combobox");

    // Select the custom ingredient to show the chip
    typeAndDebounce(input, "marinade");
    await waitFor(() => screen.getByText("My Marinade"));
    fireEvent.click(screen.getByText("My Marinade"));

    // Open the detail sheet
    await waitFor(() => screen.getByLabelText("View nutrition details"));
    fireEvent.click(screen.getByLabelText("View nutrition details"));
    await waitFor(() => screen.getByText("Submit for review"));

    // Click promote
    fireEvent.click(screen.getByText("Submit for review"));

    // Sheet should update to "Pending review" using the returned value directly
    await waitFor(() => screen.getByText("Pending review"));

    // The detail GET should NOT have been called a second time
    expect(mockGetDetail).toHaveBeenCalledTimes(1);
  });
});
