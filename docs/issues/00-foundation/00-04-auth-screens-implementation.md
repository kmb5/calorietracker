# 00-04 · Auth Screens Implementation — Login, Register, Auth Context, Route Guards

**Type:** HITL
**Blocked by:** 00-03

---

## What to build

Implement the login and register screens in React, faithfully following the approved prototype from 00-03. Wire them to the real auth API from 00-02. Establish the auth context that all other frontend slices will rely on.

This slice covers:
- **Login form** — username/email + password, calls `POST /auth/login`, displays generic error on failure
- **Register form** — username + email + password, calls `POST /auth/register`, shows field-level validation errors
- **Auth context** — React context holding the current user and access token; exposes `login()`, `logout()`, `refreshToken()` actions
- **Token storage** — access token stored in memory (not localStorage); refresh token stored in an `httpOnly` cookie via the API
- **Route guards** — unauthenticated users are redirected to `/login`; authenticated users visiting `/login` or `/register` are redirected to home
- **Token refresh** — on app load, if an access token is absent/expired, attempt a silent refresh via `POST /auth/refresh` before showing the login screen

The frontend-design skill must be invoked for the visual implementation of these screens.

## Acceptance criteria

- [ ] Login form submits to `POST /auth/login`; on success, user is redirected to the home screen
- [ ] Login form shows a non-field-specific error message on HTTP 401 ("Invalid credentials")
- [ ] Login form is disabled / shows loading state during the network request
- [ ] Register form submits to `POST /auth/register`; on success, user is logged in and redirected
- [ ] Register form shows inline errors for duplicate username/email (HTTP 400)
- [ ] Auth context is accessible app-wide; protected routes redirect to `/login` when unauthenticated
- [ ] On hard refresh, a valid refresh token cookie silently restores the session without showing the login screen
- [ ] `logout()` calls `POST /auth/logout` and clears local auth state
- [ ] Both screens are usable and visually correct at 375px (mobile) and 1280px (desktop)
- [ ] PR reviewed and approved by owner

## Blocked by

- 00-03 (approved auth screens prototype)
