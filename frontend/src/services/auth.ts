/**
 * Auth service — thin wrappers around the generated API client.
 * Access token is kept in memory (React context); refresh token in localStorage.
 */

import {
  loginAuthLoginPost,
  logoutAuthLogoutPost,
  refreshAuthRefreshPost,
  registerAuthRegisterPost,
} from "../client/services.gen";
import type { LoginRequest, RegisterRequest, TokenResponse } from "../client/types.gen";

export type { LoginRequest, RegisterRequest, TokenResponse };

export const authApi = {
  register: (payload: RegisterRequest) =>
    registerAuthRegisterPost({ requestBody: payload }),

  login: (payload: LoginRequest) => loginAuthLoginPost({ requestBody: payload }),

  refresh: (refreshToken: string) =>
    refreshAuthRefreshPost({ requestBody: { refresh_token: refreshToken } }),

  logout: (refreshToken: string) =>
    logoutAuthLogoutPost({ requestBody: { refresh_token: refreshToken } }),
};

// ── Refresh token storage (localStorage) ─────────────────────────────────────
const REFRESH_KEY = "ct_refresh_token";

export const storage = {
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_KEY, token),
  clearRefreshToken: (): void => localStorage.removeItem(REFRESH_KEY),
};
