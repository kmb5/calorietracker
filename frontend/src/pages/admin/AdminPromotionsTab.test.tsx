/**
 * AdminPromotionsTab tests
 *
 * - Shows loading skeleton then renders promotion rows
 * - Empty state when no promotions
 * - Approve removes the row and shows success toast
 * - Reject requires a note; submitting with empty note shows error toast
 * - Reject with a note succeeds and removes the row
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AdminPromotionsTab } from "./AdminPromotionsTab";
import * as services from "../../client/services.gen";
import { useToast } from "../../hooks/useToast";
import type { IngredientDetail } from "../../client/types.gen";

jest.mock("../../client/services.gen");
jest.mock("../../hooks/useToast");

const mockToast = jest.fn();
(useToast as jest.Mock).mockReturnValue({ toast: mockToast });

const MOCK_PROMOTION: IngredientDetail = {
  id: 10,
  name: "Oat Milk",
  unit: "ml",
  portion_size: 100,
  kcal: 43,
  protein: 1,
  fat: 1.5,
  carbohydrates: 6.3,
  fiber: 0.8,
  sodium: 0.05,
  is_system: false,
  owner_id: 5,
  icon: "🥛",
  is_promotion_pending: true,
  promotion_rejection_note: null,
};

describe("AdminPromotionsTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  });

  it("renders a promotion row after loading", async () => {
    (
      services.listPromotionsAdminIngredientsPromotionsGet as jest.Mock
    ).mockResolvedValue([MOCK_PROMOTION]);
    render(<AdminPromotionsTab />);
    await screen.findByText("Oat Milk");
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("shows empty state when there are no promotions", async () => {
    (
      services.listPromotionsAdminIngredientsPromotionsGet as jest.Mock
    ).mockResolvedValue([]);
    render(<AdminPromotionsTab />);
    await screen.findByText("No pending promotions");
  });

  it("approves a promotion and removes the row", async () => {
    (
      services.listPromotionsAdminIngredientsPromotionsGet as jest.Mock
    ).mockResolvedValue([MOCK_PROMOTION]);
    (
      services.approvePromotionAdminIngredientsPromotionsIngredientIdApprovePost as jest.Mock
    ).mockResolvedValue({ ...MOCK_PROMOTION, is_system: true });

    render(<AdminPromotionsTab />);
    const approveBtn = await screen.findByRole("button", { name: "Approve" });
    fireEvent.click(approveBtn);

    await waitFor(() => expect(screen.queryByText("Oat Milk")).not.toBeInTheDocument());
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  it("opens reject inline form when Reject is clicked", async () => {
    (
      services.listPromotionsAdminIngredientsPromotionsGet as jest.Mock
    ).mockResolvedValue([MOCK_PROMOTION]);
    render(<AdminPromotionsTab />);
    const rejectBtn = await screen.findByRole("button", { name: "Reject" });
    fireEvent.click(rejectBtn);

    expect(screen.getByPlaceholderText(/explain why/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Reject" })).toBeInTheDocument();
  });

  it("Confirm Reject button is disabled when note is empty", async () => {
    (
      services.listPromotionsAdminIngredientsPromotionsGet as jest.Mock
    ).mockResolvedValue([MOCK_PROMOTION]);
    render(<AdminPromotionsTab />);

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const confirmBtn = screen.getByRole("button", { name: "Confirm Reject" });

    // Button is disabled when note is empty
    expect(confirmBtn).toBeDisabled();
    // Row still present
    expect(screen.getByText("Oat Milk")).toBeInTheDocument();
  });

  it("rejects with a note, removes the row", async () => {
    (
      services.listPromotionsAdminIngredientsPromotionsGet as jest.Mock
    ).mockResolvedValue([MOCK_PROMOTION]);
    (
      services.rejectPromotionAdminIngredientsPromotionsIngredientIdRejectPost as jest.Mock
    ).mockResolvedValue({ ...MOCK_PROMOTION, is_promotion_pending: false });

    render(<AdminPromotionsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    const textarea = screen.getByPlaceholderText(/explain why/i);
    fireEvent.change(textarea, { target: { value: "Not a real food" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Reject" }));

    await waitFor(() => expect(screen.queryByText("Oat Milk")).not.toBeInTheDocument());
  });

  it("cancels the reject form without removing the row", async () => {
    (
      services.listPromotionsAdminIngredientsPromotionsGet as jest.Mock
    ).mockResolvedValue([MOCK_PROMOTION]);
    render(<AdminPromotionsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Oat Milk")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/explain why/i)).not.toBeInTheDocument();
  });
});
