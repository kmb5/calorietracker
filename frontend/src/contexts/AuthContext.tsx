import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { authApi, storage, type LoginRequest, type RegisterRequest } from "../services/auth";

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
  /** Attempt a silent refresh using the stored refresh token. */
  refreshToken: () => Promise<boolean>;
  /** Clear auth state and revoke the refresh token. */
  logout: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    loading: true,
  });

  // Keep a ref so callbacks always see the latest refresh token without
  // triggering re-renders.
  const refreshTokenRef = useRef<string | null>(null);

  const setTokens = useCallback((accessToken: string, refreshToken: string) => {
    refreshTokenRef.current = refreshToken;
    storage.setRefreshToken(refreshToken);
    setState({ accessToken, loading: false });
  }, []);

  const clearTokens = useCallback(() => {
    refreshTokenRef.current = null;
    storage.clearRefreshToken();
    setState({ accessToken: null, loading: false });
  }, []);

  // ── Silent refresh on mount ───────────────────────────────────────────────
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const stored = storage.getRefreshToken();
    if (!stored) {
      setState((s) => ({ ...s, loading: false }));
      return false;
    }
    try {
      const data = await authApi.refresh(stored);
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      clearTokens();
      return false;
    }
  }, [clearTokens, setTokens]);

  useEffect(() => {
    refreshToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const login = useCallback(
    async (payload: LoginRequest) => {
      const data = await authApi.login(payload);
      setTokens(data.access_token, data.refresh_token);
    },
    [setTokens]
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const data = await authApi.register(payload);
      setTokens(data.access_token, data.refresh_token);
    },
    [setTokens]
  );

  const logout = useCallback(async () => {
    const rt = refreshTokenRef.current ?? storage.getRefreshToken();
    if (rt) {
      await authApi.logout(rt).catch(() => {
        // Ignore logout errors — clear local state regardless
      });
    }
    clearTokens();
  }, [clearTokens]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, refreshToken, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// Export the context for the useAuth hook — not for direct use elsewhere
export { AuthContext };
export type { AuthContextValue };
