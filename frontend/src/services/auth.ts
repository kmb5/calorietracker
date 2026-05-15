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
// KNOWN TRADE-OFF: The refresh token (7-day lifetime) is persisted in
// localStorage for simplicity. localStorage is readable by any JavaScript on
// the page, making it a higher-value XSS target than an HttpOnly cookie.
//
// The preferred hardening path is to have the backend set the refresh token as
// an `HttpOnly; Secure; SameSite=Strict` cookie so the browser sends it
// automatically and JS can never read it. This has been deferred to a future
// iteration; the access token (15-min lifetime) is already kept in memory only
// which limits the blast radius of a successful XSS attack.
const REFRESH_KEY = "ct_refresh_token";

export const storage = {
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_KEY, token),
  clearRefreshToken: (): void => localStorage.removeItem(REFRESH_KEY),
};
