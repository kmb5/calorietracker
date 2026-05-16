/**
 * AdminRoute tests
 *
 * - Unauthenticated → redirects to /login
 * - Authenticated but role=user → redirects to /
 * - Authenticated and role=admin → renders child routes
 * - loading=true → renders spinner, no redirect
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./AdminRoute";
import { useAuth } from "../hooks/useAuth";

jest.mock("../hooks/useAuth");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function makeAuthMock(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    accessToken: null,
    role: null,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>;
}

function renderAdminRoute(initialPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminRoute", () => {
  it("redirects to /login when unauthenticated", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ accessToken: null, role: null }));
    renderAdminRoute();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
  });

  it("redirects to / when authenticated but role=user", () => {
    mockUseAuth.mockReturnValue(
      makeAuthMock({ accessToken: "token-abc", role: "user" })
    );
    renderAdminRoute();
    expect(screen.getByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
  });

  it("renders child route when authenticated and role=admin", () => {
    mockUseAuth.mockReturnValue(
      makeAuthMock({ accessToken: "token-abc", role: "admin" })
    );
    renderAdminRoute();
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("renders spinner (no redirect) while loading=true", () => {
    mockUseAuth.mockReturnValue(makeAuthMock({ loading: true }));
    renderAdminRoute();
    // Spinner present; neither redirect target rendered
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
  });
});
