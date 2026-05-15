/**
 * AuthContext tests
 *
 * Strategy: mock `../services/auth` at the module level so no real HTTP is
 * made. Each test controls what authApi returns.
 *
 * The refresh token is an HttpOnly cookie managed by the browser/server —
 * JS never reads or writes it, so there are no storage assertions here.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../services/auth";

// ── Module-level mocks ────────────────────────────────────────────────────────

jest.mock("../services/auth", () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

const TOKEN_RESPONSE = {
  access_token: "access-abc",
  token_type: "bearer",
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Render useAuth inside a fresh AuthProvider and wait for loading to finish. */
async function renderAuth() {
  const result = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.result.current.loading).toBe(false));
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no cookie / expired cookie → refresh fails → unauthenticated
  mockAuthApi.refresh.mockRejectedValue(new Error("401"));
});

describe("initial load — no valid cookie", () => {
  it("starts loading=true then settles to unauthenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    // Must eventually settle
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessToken).toBeNull();
    expect(mockAuthApi.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("initial load — valid cookie present", () => {
  it("silently restores the session", async () => {
    mockAuthApi.refresh.mockResolvedValue(TOKEN_RESPONSE);

    const { result } = await renderAuth();

    expect(result.current.accessToken).toBe("access-abc");
    expect(mockAuthApi.refresh).toHaveBeenCalledTimes(1);
  });

  it("clears state when refresh fails", async () => {
    mockAuthApi.refresh.mockRejectedValue(new Error("401"));

    const { result } = await renderAuth();

    expect(result.current.accessToken).toBeNull();
  });
});

describe("login()", () => {
  it("sets the access token on success", async () => {
    mockAuthApi.login.mockResolvedValue(TOKEN_RESPONSE);
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.login({ username: "alice", password: "pass1234" });
    });

    expect(result.current.accessToken).toBe("access-abc");
  });

  it("propagates errors so the caller can handle them", async () => {
    mockAuthApi.login.mockRejectedValue(new Error("401 Unauthorized"));
    const { result } = await renderAuth();

    await expect(
      act(async () => {
        await result.current.login({ username: "alice", password: "wrong" });
      })
    ).rejects.toThrow();

    expect(result.current.accessToken).toBeNull();
  });
});

describe("register()", () => {
  it("sets the access token on success", async () => {
    mockAuthApi.register.mockResolvedValue(TOKEN_RESPONSE);
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.register({
        username: "newuser",
        email: "new@example.com",
        password: "password123",
      });
    });

    expect(result.current.accessToken).toBe("access-abc");
  });

  it("propagates errors so the caller can handle them", async () => {
    mockAuthApi.register.mockRejectedValue(new Error("400 Bad Request"));
    const { result } = await renderAuth();

    await expect(
      act(async () => {
        await result.current.register({
          username: "x",
          email: "bad",
          password: "short",
        });
      })
    ).rejects.toThrow();
  });
});

describe("logout()", () => {
  it("clears the access token and calls the API", async () => {
    mockAuthApi.refresh.mockResolvedValue(TOKEN_RESPONSE);
    mockAuthApi.logout.mockResolvedValue(undefined);

    const { result } = await renderAuth();
    expect(result.current.accessToken).toBe("access-abc");

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.accessToken).toBeNull();
    // logout takes no arguments — the cookie is sent by the browser
    expect(mockAuthApi.logout).toHaveBeenCalledWith();
  });

  it("clears local state even when the API call fails", async () => {
    mockAuthApi.refresh.mockResolvedValue(TOKEN_RESPONSE);
    mockAuthApi.logout.mockRejectedValue(new Error("network error"));

    const { result } = await renderAuth();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.accessToken).toBeNull();
  });
});

describe("useAuth() outside AuthProvider", () => {
  it("throws a descriptive error", () => {
    // Suppress the React error boundary console.error noise
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used inside <AuthProvider>"
    );
  });
});
