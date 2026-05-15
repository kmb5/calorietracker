/**
 * AuthContext tests
 *
 * Strategy: mock `../services/auth` at the module level so no real HTTP is
 * made. Each test controls what authApi and storage return.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuth } from "../hooks/useAuth";
import { authApi, storage } from "../services/auth";

// ── Module-level mocks ────────────────────────────────────────────────────────

jest.mock("../services/auth", () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  },
  storage: {
    getRefreshToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockStorage = storage as jest.Mocked<typeof storage>;

const TOKEN_RESPONSE = {
  access_token: "access-abc",
  refresh_token: "refresh-xyz",
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
  // Default: no stored refresh token → user is unauthenticated
  mockStorage.getRefreshToken.mockReturnValue(null);
});

describe("initial load — no stored refresh token", () => {
  it("starts loading=true then settles to unauthenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    // May or may not observe loading=true depending on timing, but must settle
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessToken).toBeNull();
    expect(mockAuthApi.refresh).not.toHaveBeenCalled();
  });
});

describe("initial load — valid stored refresh token", () => {
  it("silently restores the session", async () => {
    mockStorage.getRefreshToken.mockReturnValue("stored-rt");
    mockAuthApi.refresh.mockResolvedValue(TOKEN_RESPONSE);

    const { result } = await renderAuth();

    expect(result.current.accessToken).toBe("access-abc");
    expect(mockStorage.setRefreshToken).toHaveBeenCalledWith("refresh-xyz");
  });

  it("clears state when refresh fails", async () => {
    mockStorage.getRefreshToken.mockReturnValue("expired-rt");
    mockAuthApi.refresh.mockRejectedValue(new Error("401"));

    const { result } = await renderAuth();

    expect(result.current.accessToken).toBeNull();
    expect(mockStorage.clearRefreshToken).toHaveBeenCalled();
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
    expect(mockStorage.setRefreshToken).toHaveBeenCalledWith("refresh-xyz");
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
    mockStorage.getRefreshToken.mockReturnValue("stored-rt");
    mockAuthApi.refresh.mockResolvedValue(TOKEN_RESPONSE);
    mockAuthApi.logout.mockResolvedValue(undefined);

    const { result } = await renderAuth();
    expect(result.current.accessToken).toBe("access-abc");

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.accessToken).toBeNull();
    expect(mockAuthApi.logout).toHaveBeenCalledWith("refresh-xyz");
    expect(mockStorage.clearRefreshToken).toHaveBeenCalled();
  });

  it("clears local state even when the API call fails", async () => {
    mockStorage.getRefreshToken.mockReturnValue("stored-rt");
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
