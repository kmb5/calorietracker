/**
 * LoginPage tests
 *
 * Covers the acceptance criteria from issue #4:
 * - Form submits to login(); on success navigates home
 * - Shows a generic error on 401
 * - Is disabled / shows loading state during the request
 * - Client-side validation: empty fields show field errors
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "../client/core/ApiError";
import { LoginPage } from "./LoginPage";
import { useAuth } from "../hooks/useAuth";

jest.mock("../hooks/useAuth");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function makeAuthMock(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    accessToken: null,
    role: null,
    userId: null,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    ...overrides,
  };
}

function renderLoginPage(initialPath = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue(makeAuthMock());
});

describe("LoginPage — validation", () => {
  it("shows field errors when submitted empty", async () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it("does not call login() when fields are empty", async () => {
    const auth = makeAuthMock();
    mockUseAuth.mockReturnValue(auth);
    renderLoginPage();
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(auth.login).not.toHaveBeenCalled();
  });
});

describe("LoginPage — successful login", () => {
  it("calls login() with entered credentials and navigates home", async () => {
    const auth = makeAuthMock({ login: jest.fn().mockResolvedValue(undefined) });
    mockUseAuth.mockReturnValue(auth);
    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith({
        username: "alice",
        password: "secret123",
      });
    });
    expect(await screen.findByText("Home")).toBeInTheDocument();
  });
});

describe("LoginPage — error handling", () => {
  it("shows a generic error message on 401", async () => {
    const err = new ApiError(
      { method: "POST", url: "/auth/login" },
      {
        url: "/auth/login",
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        body: {},
      },
      "Unauthorized"
    );
    const auth = makeAuthMock({ login: jest.fn().mockRejectedValue(err) });
    mockUseAuth.mockReturnValue(auth);
    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it("shows a fallback error on unexpected API errors", async () => {
    const err = new ApiError(
      { method: "POST", url: "/auth/login" },
      {
        url: "/auth/login",
        ok: false,
        status: 500,
        statusText: "Server Error",
        body: {},
      },
      "Server Error"
    );
    const auth = makeAuthMock({ login: jest.fn().mockRejectedValue(err) });
    mockUseAuth.mockReturnValue(auth);
    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "pass");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});

describe("LoginPage — loading state", () => {
  it("disables the submit button while the request is in flight", async () => {
    let resolve!: () => void;
    const pendingLogin = new Promise<void>((res) => {
      resolve = res;
    });
    const auth = makeAuthMock({ login: jest.fn().mockReturnValue(pendingLogin) });
    mockUseAuth.mockReturnValue(auth);
    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "pass");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    });

    resolve();
  });
});
