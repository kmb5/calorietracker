# 00-02 · Auth Backend — Register, Login, Refresh, Logout, Rate Limiting

**Type:** AFK
**Blocked by:** 00-01

---

## What to build

Implement the complete authentication backend: user registration, login, JWT access + refresh token issuance, token refresh, logout with token revocation, and rate limiting on the login endpoint. This is a pure backend slice — no UI.

The auth flow (from PRD 00):
```
POST /auth/register  → creates User, returns access token + refresh token
POST /auth/login     → validates credentials, returns access token + refresh token
POST /auth/refresh   → validates refresh token hash in DB, returns new access token
POST /auth/logout    → marks refresh token as revoked in DB
```

Key decisions baked in:
- Passwords: bcrypt cost factor ≥ 12 (`passlib[bcrypt]`)
- Access token: 15-minute expiry, JWT (HS256 or RS256)
- Refresh token: 7-day expiry, stored as **bcrypt hash** in DB (never plaintext)
- Rate limiting: 5 failed login attempts per IP per minute → HTTP 429 (`slowapi` backed by in-memory store for dev, Redis for production)
- Error messages never reveal which field (username vs password) was wrong
- Admin role exists on the User model but is not self-assignable via registration

Schema introduced:
```
User: id, username (unique), email (unique), hashed_password, role (user|admin),
      is_active, created_at, updated_at

RefreshToken: id, user_id (FK), token_hash, expires_at, revoked_at
```

Alembic migration included.

## Acceptance criteria

- [ ] `POST /auth/register` creates a user and returns `access_token` + `refresh_token`
- [ ] Registering with a duplicate username or email returns HTTP 400
- [ ] `POST /auth/login` returns tokens on valid credentials
- [ ] `POST /auth/login` returns HTTP 401 with a generic error message on wrong password (message does not indicate which field was wrong)
- [ ] `POST /auth/refresh` returns a new access token when a valid, non-revoked refresh token is presented
- [ ] `POST /auth/logout` marks the refresh token as revoked; subsequent use of that token returns HTTP 401
- [ ] 5 failed login attempts from the same IP within 1 minute returns HTTP 429 on the 6th attempt
- [ ] Access token encodes `user_id` and `role`; expiry is 15 minutes
- [ ] Refresh token is stored as a bcrypt hash in the `refresh_tokens` table — plaintext is never persisted
- [ ] Passwords are hashed with bcrypt cost ≥ 12
- [ ] A deactivated user's login attempt returns HTTP 403 (enforcement lives in the auth layer; the endpoint to set `is_active` is implemented in 00-12 admin backend)
- [ ] Alembic migration for `users` and `refresh_tokens` tables applies cleanly
- [ ] All tests run against a dedicated test PostgreSQL database (separate DB, seeded in fixtures)

## Blocked by

- 00-01 (project scaffold, Docker, Alembic)
