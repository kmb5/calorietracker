/**
 * AdminUsersTab tests
 *
 * - Renders user rows after loading
 * - Deactivate button calls the API and updates the row
 * - Activate button works for inactive users
 * - Promote to Admin calls the API and removes the "Make Admin" button
 * - "You" label + no action buttons for current user
 * - Search filters by username/email
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AdminUsersTab } from "./AdminUsersTab";
import * as services from "../../client/services.gen";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import type { UserAdminResponse } from "../../client/types.gen";

jest.mock("../../client/services.gen");
jest.mock("../../hooks/useToast");
jest.mock("../../hooks/useAuth");

const mockToast = jest.fn();
(useToast as jest.Mock).mockReturnValue({ toast: mockToast });

// Current user has id=1 (encoded in this mini JWT payload)
const FAKE_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9." + btoa(JSON.stringify({ sub: "1", role: "admin" })) + ".sig";

function mockAuth(token = FAKE_TOKEN) {
  (useAuth as jest.Mock).mockReturnValue({
    accessToken: token,
    role: "admin",
    loading: false,
    logout: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    refreshToken: jest.fn(),
  });
}

const ADMIN_USER: UserAdminResponse = {
  id: 1,
  username: "alice",
  email: "alice@example.com",
  role: "admin",
  is_active: true,
};

const REGULAR_USER: UserAdminResponse = {
  id: 2,
  username: "bob",
  email: "bob@example.com",
  role: "user",
  is_active: true,
};

const INACTIVE_USER: UserAdminResponse = {
  id: 3,
  username: "carol",
  email: "carol@example.com",
  role: "user",
  is_active: false,
};

describe("AdminUsersTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  });

  it("renders user rows after loading", async () => {
    (services.listUsersAdminUsersGet as jest.Mock).mockResolvedValue([
      ADMIN_USER,
      REGULAR_USER,
    ]);
    render(<AdminUsersTab />);
    await screen.findByText("bob");
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("marks the current user's row with 'You' label and no action buttons", async () => {
    (services.listUsersAdminUsersGet as jest.Mock).mockResolvedValue([ADMIN_USER]);
    render(<AdminUsersTab />);
    await screen.findByText("alice");
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deactivate/i })
    ).not.toBeInTheDocument();
  });

  it("deactivates an active user", async () => {
    (services.listUsersAdminUsersGet as jest.Mock).mockResolvedValue([REGULAR_USER]);
    (services.updateUserActiveAdminUsersUserIdPatch as jest.Mock).mockResolvedValue({
      ...REGULAR_USER,
      is_active: false,
    });

    render(<AdminUsersTab />);
    const deactivateBtn = await screen.findByRole("button", { name: /deactivate/i });
    fireEvent.click(deactivateBtn);

    await waitFor(() =>
      expect(services.updateUserActiveAdminUsersUserIdPatch).toHaveBeenCalledWith({
        userId: 2,
        requestBody: { is_active: false },
      })
    );
    await screen.findByText("Inactive");
  });

  it("activates an inactive user", async () => {
    (services.listUsersAdminUsersGet as jest.Mock).mockResolvedValue([INACTIVE_USER]);
    (services.updateUserActiveAdminUsersUserIdPatch as jest.Mock).mockResolvedValue({
      ...INACTIVE_USER,
      is_active: true,
    });

    render(<AdminUsersTab />);
    const activateBtn = await screen.findByRole("button", { name: /activate/i });
    fireEvent.click(activateBtn);

    await waitFor(() =>
      expect(services.updateUserActiveAdminUsersUserIdPatch).toHaveBeenCalled()
    );
    await screen.findByText("Active");
  });

  it("promotes a user to admin", async () => {
    (services.listUsersAdminUsersGet as jest.Mock).mockResolvedValue([REGULAR_USER]);
    (services.updateUserRoleAdminUsersUserIdRolePatch as jest.Mock).mockResolvedValue({
      ...REGULAR_USER,
      role: "admin",
    });

    render(<AdminUsersTab />);
    const promoteBtn = await screen.findByRole("button", { name: /make admin/i });
    fireEvent.click(promoteBtn);

    await waitFor(() =>
      expect(services.updateUserRoleAdminUsersUserIdRolePatch).toHaveBeenCalledWith({
        userId: 2,
        requestBody: { role: "admin" },
      })
    );
    // "Make Admin" button disappears once the user is admin
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /make admin/i })
      ).not.toBeInTheDocument()
    );
  });

  it("filters users by search query", async () => {
    (services.listUsersAdminUsersGet as jest.Mock).mockResolvedValue([
      REGULAR_USER,
      INACTIVE_USER,
    ]);
    render(<AdminUsersTab />);
    await screen.findByText("bob");

    fireEvent.change(screen.getByPlaceholderText(/search by username/i), {
      target: { value: "carol" },
    });

    expect(screen.queryByText("bob")).not.toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
  });
});
