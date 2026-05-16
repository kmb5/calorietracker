/**
 * AdminBulkImportTab tests
 *
 * - Renders drop zone and format reference
 * - Import button is disabled until a file is selected
 * - Parses valid JSON and calls the bulk import API
 * - Shows result summary after successful import
 * - Shows parse error for invalid JSON
 * - "Import another file" resets the form
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminBulkImportTab } from "./AdminBulkImportTab";
import * as services from "../../client/services.gen";
import { useToast } from "../../hooks/useToast";

jest.mock("../../client/services.gen");
jest.mock("../../hooks/useToast");

const mockToast = jest.fn();
(useToast as jest.Mock).mockReturnValue({ toast: mockToast });

const VALID_JSON = JSON.stringify([
  {
    name: "Oat Milk",
    unit: "ml",
    portion_size: 100,
    kcal: 43,
    protein: 1,
    fat: 1.5,
    carbohydrates: 6.3,
    fiber: 0.8,
    sodium: 0.05,
    icon: "🥛",
  },
]);

function makeJsonFile(content: string, name = "import.json") {
  const file = new File([content], name, { type: "application/json" });
  // jsdom doesn't implement File.prototype.text — shim it
  Object.defineProperty(file, "text", {
    value: () => Promise.resolve(content),
  });
  return file;
}

describe("AdminBulkImportTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  });

  it("renders the drop zone and format reference", () => {
    render(<AdminBulkImportTab />);
    expect(screen.getByText(/drop a json file here/i)).toBeInTheDocument();
    expect(screen.getByText(/expected json format/i)).toBeInTheDocument();
  });

  it("Import button is disabled when no file is selected", () => {
    render(<AdminBulkImportTab />);
    expect(screen.getByRole("button", { name: /import/i })).toBeDisabled();
  });

  it("calls bulk import API with valid JSON and shows result", async () => {
    (
      services.bulkImportIngredientsAdminIngredientsBulkImportPost as jest.Mock
    ).mockResolvedValue({ created: 1, updated: 0, total: 1 });

    render(<AdminBulkImportTab />);

    const input = screen.getByLabelText(/upload json file/i);
    fireEvent.change(input, { target: { files: [makeJsonFile(VALID_JSON)] } });

    const importBtn = await screen.findByRole("button", { name: /^import$/i });
    expect(importBtn).not.toBeDisabled();
    fireEvent.click(importBtn);

    await screen.findByText("Import complete");
    // "Created" stat shows the count
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  it("shows parse error for invalid JSON content", async () => {
    render(<AdminBulkImportTab />);
    const input = screen.getByLabelText(/upload json file/i);
    fireEvent.change(input, { target: { files: [makeJsonFile("not json at all")] } });

    const importBtn = await screen.findByRole("button", { name: /^import$/i });
    fireEvent.click(importBtn);

    await screen.findByText(/parse error/i);
  });

  it("shows parse error when JSON is not an array", async () => {
    render(<AdminBulkImportTab />);
    const input = screen.getByLabelText(/upload json file/i);
    fireEvent.change(input, {
      target: { files: [makeJsonFile(JSON.stringify({ key: "value" }))] },
    });

    const importBtn = await screen.findByRole("button", { name: /^import$/i });
    fireEvent.click(importBtn);

    await screen.findByText(/parse error/i);
    expect(screen.getByText(/json must be an array/i)).toBeInTheDocument();
  });

  it("resets the form after clicking 'Import another file'", async () => {
    (
      services.bulkImportIngredientsAdminIngredientsBulkImportPost as jest.Mock
    ).mockResolvedValue({ created: 0, updated: 1, total: 1 });

    render(<AdminBulkImportTab />);
    const input = screen.getByLabelText(/upload json file/i);
    fireEvent.change(input, { target: { files: [makeJsonFile(VALID_JSON)] } });

    fireEvent.click(await screen.findByRole("button", { name: /^import$/i }));
    await screen.findByText("Import complete");

    fireEvent.click(screen.getByText(/import another file/i));

    expect(screen.getByText(/drop a json file here/i)).toBeInTheDocument();
    expect(screen.queryByText("Import complete")).not.toBeInTheDocument();
  });
});
