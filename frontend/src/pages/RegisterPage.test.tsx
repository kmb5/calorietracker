/**
 * RegisterPage tests
 *
 * Covers the acceptance criteria from issue #4:
 * - Submits to register(); on success navigates home
 * - Client-side validation: username <3 chars, invalid email, password <8 chars
 * - Shows inline field errors for duplicate username/email (HTTP 400)
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "../client/core/ApiError";
import { RegisterPage } from "./RegisterPage";
import { useAuth } from "../hooks/useAuth";

jest.mock("../hooks/useAuth");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function makeAuthMock(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    accessToken: null,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    ...overrides,
  };
}

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillForm(username: string, email: string, password: string) {
  if (username) await userEvent.type(screen.getByLabelText(/username/i), username);
  if (email) await userEvent.type(screen.getByLabelText("Email address"), email);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
}

beforeEach(() => {
  mockUseAuth.mockReturnValue(makeAuthMock());
});

describe("RegisterPage — validation", () => {
  it("shows errors when all fields are empty", async () => {
    renderRegisterPage();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it("rejects a username shorter than 3 characters", async () => {
    renderRegisterPage();
    await fillForm("ab", "a@b.com", "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(
      await screen.findByText(/at least 3 characters/i)
    ).toBeInTheDocument();
  });

  it("rejects a malformed email address", async () => {
    renderRegisterPage();
    await fillForm("alice", "not-an-email", "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it("rejects a password shorter than 8 characters", async () => {
    renderRegisterPage();
    await fillForm("alice", "alice@example.com", "short");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(
      await screen.findByText(/at least 8 characters/i)
    ).toBeInTheDocument();
  });

  it("does not call register() when validation fails", async () => {
    const auth = makeAuthMock();
    mockUseAuth.mockReturnValue(auth);
    renderRegisterPage();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(auth.register).not.toHaveBeenCalled();
  });
});

describe("RegisterPage — successful registration", () => {
  it("calls register() with all fields and navigates home", async () => {
    const auth = makeAuthMock({ register: jest.fn().mockResolvedValue(undefined) });
    mockUseAuth.mockReturnValue(auth);
    renderRegisterPage();

    await fillForm("alice", "alice@example.com", "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(auth.register).toHaveBeenCalledWith({
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      });
    });
    expect(await screen.findByText("Home")).toBeInTheDocument();
  });
});

describe("RegisterPage — server errors", () => {
  function makeApiError(detail: string) {
    return new ApiError(
      { method: "POST", url: "/auth/register" },
      {
        url: "/auth/register",
        ok: false,
        status: 400,
        statusText: "Bad Request",
        body: { detail },
      },
      detail
    );
  }

  it("shows username-taken error on duplicate username", async () => {
    const auth = makeAuthMock({
      register: jest.fn().mockRejectedValue(makeApiError("username already registered")),
    });
    mockUseAuth.mockReturnValue(auth);
    renderRegisterPage();

    await fillForm("alice", "alice@example.com", "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/username already registered/i)).toBeInTheDocument();
    expect(screen.getByText(/username already taken/i)).toBeInTheDocument();
  });

  it("shows email-taken error on duplicate email", async () => {
    const auth = makeAuthMock({
      register: jest.fn().mockRejectedValue(makeApiError("email already registered")),
    });
    mockUseAuth.mockReturnValue(auth);
    renderRegisterPage();

    await fillForm("alice", "alice@example.com", "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/email already registered/i)).toBeInTheDocument();
    expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
  });

  it("shows a fallback alert for unexpected errors", async () => {
    const auth = makeAuthMock({
      register: jest.fn().mockRejectedValue(new Error("network error")),
    });
    mockUseAuth.mockReturnValue(auth);
    renderRegisterPage();

    await fillForm("alice", "alice@example.com", "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
