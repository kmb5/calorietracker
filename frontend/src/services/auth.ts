/**
 * Auth service — thin wrappers around the generated API client.
 * Access token is kept in memory (React context).
 * Refresh token is stored as an HttpOnly cookie set by the server — JS never
 * reads or writes it directly.  The browser sends it automatically on requests
 * to /auth/refresh and /auth/logout (CREDENTIALS: "include" is set in
 * OpenAPI.ts).
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

  // No token argument — the browser sends the HttpOnly refresh cookie automatically.
  refresh: () => refreshAuthRefreshPost(),

  // No token argument — the browser sends the HttpOnly refresh cookie automatically.
  logout: () => logoutAuthLogoutPost(),
};
