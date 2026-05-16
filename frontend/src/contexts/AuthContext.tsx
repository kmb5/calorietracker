import { createContext, useCallback, useEffect, useState } from "react";
import { OpenAPI } from "../client/core/OpenAPI";
import { authApi, type LoginRequest, type RegisterRequest } from "../services/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  /** In-memory access token. Null means unauthenticated. */
  accessToken: string | null;
  /** True while the initial silent-refresh attempt is in progress. */
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  /** Log in with username + password. Throws on failure. */
  login: (payload: LoginRequest) => Promise<void>;
  /** Register a new account. Throws on failure. */
  register: (payload: RegisterRequest) => Promise<void>;
  /** Attempt a silent refresh using the HttpOnly refresh token cookie. */
  refreshToken: () => Promise<boolean>;
  /** Clear auth state and revoke the refresh token cookie. */
  logout: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    loading: true,
  });

  const setAccessToken = useCallback((accessToken: string) => {
    OpenAPI.TOKEN = accessToken;
    setState({ accessToken, loading: false });
  }, []);

  const clearAccessToken = useCallback(() => {
    OpenAPI.TOKEN = undefined;
    setState({ accessToken: null, loading: false });
  }, []);

  // ── Silent refresh on mount ───────────────────────────────────────────────
  // The browser automatically sends the HttpOnly refresh token cookie —
  // no token value is read or managed by JS.
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const data = await authApi.refresh();
      setAccessToken(data.access_token);
      return true;
    } catch {
      clearAccessToken();
      return false;
    }
  }, [clearAccessToken, setAccessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshToken();
  }, [refreshToken]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const login = useCallback(
    async (payload: LoginRequest) => {
      const data = await authApi.login(payload);
      setAccessToken(data.access_token);
    },
    [setAccessToken]
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const data = await authApi.register(payload);
      setAccessToken(data.access_token);
    },
    [setAccessToken]
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {
      // Ignore logout errors — clear local state regardless
    });
    clearAccessToken();
  }, [clearAccessToken]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, refreshToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// Export the context for the useAuth hook — not for direct use elsewhere
export { AuthContext };
export type { AuthContextValue };
