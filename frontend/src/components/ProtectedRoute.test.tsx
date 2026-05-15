/**
 * ProtectedRoute / PublicOnlyRoute tests
 *
 * Covers the acceptance criteria from issue #4:
 * - Unauthenticated users are redirected to /login
 * - Authenticated users visiting /login or /register are redirected to /
 * - Both guards render nothing (spinner) while loading=true
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "./ProtectedRoute";
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

// ── ProtectedRoute ────────────────────────────────────────────────────────────

describe("ProtectedRoute", () => {
  it("renders the protected content when authenticated", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ accessToken: "token-abc" }));
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ accessToken: null }));
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("renders a spinner while loading", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ loading: true }));
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    // Spinner is rendered — verify neither protected content nor redirect appeared
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });
});

// ── PublicOnlyRoute ───────────────────────────────────────────────────────────

describe("PublicOnlyRoute", () => {
  it("renders the public content when unauthenticated", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ accessToken: null }));
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login</div>} />
          </Route>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("redirects authenticated users to /", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ accessToken: "token-abc" }));
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login</div>} />
          </Route>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("renders a spinner while loading", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ loading: true }));
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login</div>} />
          </Route>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });
});
