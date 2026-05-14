# PRD 00 — Foundation: Project Setup, Auth, Ingredient Database & Admin

## Problem Statement

Building a calorie tracker from scratch requires a reliable, shared foundation before any feature can ship: a deployable project skeleton, a secure user authentication system, a seeded food ingredient database that users can extend, and an admin layer for curating that database. Without this foundation, every feature built on top would be duplicating infrastructure decisions or working against inconsistent assumptions.

## Solution

Establish the full-stack project skeleton (React/TypeScript frontend + FastAPI backend) wired together in Docker Compose, with a PostgreSQL database, JWT-based auth, and a seeded ingredient database sourced from Open Food Facts. An admin role gives designated users the ability to manage the global ingredient pool and user accounts.

## User Stories

### Auth — Registration & Login
1. As a new user, I want to register with a username, email, and password, so that I can have a personal account to store my data.
2. As a user, I want my password stored with bcrypt hashing and a unique salt, so that my credentials are safe even if the database is compromised.
3. As a user, I want to log in with my username/email and password and receive a JWT access token, so that I can authenticate subsequent API requests.
4. As a user, I want a refresh token mechanism, so that I stay logged in across sessions without re-entering my credentials every time.
5. As a user, I want the login form to rate-limit failed attempts, so that brute-force attacks are prevented.
6. As a user, I want a clear error message when my credentials are incorrect, without revealing which part (username vs password) was wrong.
7. As a user, I want to log out and have my refresh token invalidated, so that my session is fully terminated.
8. As a user, I want my JWT access token to expire after a short window (e.g. 15 minutes), so that stolen tokens have a limited blast radius.
9. As an admin, I want to be able to deactivate a user account, so that I can remove access without deleting their data.
10. As an admin, I want to promote a regular user to admin role, so that trusted members can help curate the ingredient database.

### Ingredient Database — Browsing & Searching
11. As a user, I want to search the ingredient database by name with autocomplete, so that I can quickly find the ingredient I need without scrolling through hundreds of items.
12. As a user, I want search results to show the ingredient name, unit, portion size, and kcal at a glance, so that I can confirm I'm picking the right item.
13. As a user, I want system ingredients (from the seeded dataset) and my own custom ingredients to appear together in search results, so that I have one unified search experience.
14. As a user, I want to see a badge or indicator distinguishing system ingredients from my own custom ingredients in search results, so that I know the provenance of the data.
15. As a user, I want to filter search results by unit type (e.g. show only gram-based items), so that I can narrow down to relevant entries.
16. As a user, I want to view the full nutrition detail of any ingredient (kcal, protein, fat, carbs, fiber, sodium per portion), so that I can verify the data before using it.

### Ingredient Database — User Custom Ingredients
17. As a user, I want to add a custom ingredient with name, unit, portion size, kcal, protein, fat, carbohydrates, fiber, and sodium, so that I can track foods not in the system database.
18. As a user, I want my custom ingredients to be private by default, so that my personal brand-specific entries don't pollute the shared database.
19. As a user, I want to edit my own custom ingredients, so that I can correct mistakes or update values.
20. As a user, I want to delete my own custom ingredients, so that I can remove entries I no longer need.
21. As a user, I want to submit a custom ingredient for admin review/promotion to the global pool, so that other users can benefit from my addition.

### Ingredient Database — Admin Curation
22. As an admin, I want to see a list of user-submitted ingredient promotion requests, so that I can review and act on them.
23. As an admin, I want to approve a user-submitted ingredient and promote it to a system ingredient, so that it becomes available to all users.
24. As an admin, I want to reject a promotion request with an optional note, so that I can explain why an ingredient was not promoted.
25. As an admin, I want to add new system ingredients directly, so that I can seed the database with well-verified entries.
26. As an admin, I want to edit any system ingredient, so that I can correct errors in the seeded data.
27. As an admin, I want to delete a system ingredient (with a confirmation step), so that I can remove duplicates or incorrect entries.
28. As an admin, I want to bulk-import ingredients from a JSON file matching the seeded data format, so that I can efficiently expand the database.

### Infrastructure & Developer Experience
29. As a developer, I want a `docker-compose.yml` that starts the backend, frontend dev server, and PostgreSQL with a single `docker compose up`, so that local onboarding is frictionless.
30. As a developer, I want database migrations managed via Alembic, so that schema changes are versioned and repeatable.
31. As a developer, I want a seed script that imports a curated Open Food Facts subset into the system ingredient table on first run, so that the app is immediately useful after setup.
32. As a developer, I want environment variables managed via `.env` files with a committed `.env.example`, so that configuration is documented and never accidentally committed.
33. As a developer, I want the frontend and backend to communicate via a typed API client (auto-generated from the FastAPI OpenAPI schema), so that TypeScript types stay in sync with the backend contract.
34. As a developer, I want linting (ruff + eslint), formatting (ruff + prettier), and type checking (mypy + tsc) configured as pre-commit hooks, so that code quality gates are automatic.

## Implementation Decisions

### Stack
- **Frontend**: React 18 + TypeScript, pnpm, Vite, Jest + Testing Library, shadcn/ui + Tailwind CSS
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2
- **Database**: PostgreSQL 16 (Docker container), no SQLite at any stage
- **Auth**: `python-jose` for JWT, `passlib[bcrypt]` for password hashing, refresh tokens stored in DB (not only in-memory)
- **Containerisation**: Docker + Docker Compose; one service per concern (api, frontend, db)
- **API client**: `openapi-typescript-codegen` or `hey-api/openapi-ts` to generate typed fetch client from FastAPI's `/openapi.json`

### Data Model — Core Entities

**User**
```
id, username (unique), email (unique), hashed_password, role (user | admin),
is_active, created_at, updated_at
```

**RefreshToken**
```
id, user_id (FK), token_hash, expires_at, revoked_at
```

**Ingredient** (shared table for both system and user ingredients)
```
id, name, unit (g | ml | tablespoon | piece),
portion_size (float),           -- the "per X" baseline
kcal (float),                   -- per portion_size
protein (float), fat (float), carbohydrates (float),
fiber (float), sodium (float),  -- all per portion_size; NOTE: sodium is in **mg**, all other macros in g
is_system (bool),               -- true = seeded/admin-managed
owner_id (FK nullable),         -- null for system ingredients; user_id for custom
is_promotion_pending (bool),    -- user has submitted for admin review
created_at, updated_at
```

The unit + portion_size design is taken directly from the prototype:
```python
# From calorie-counter prototype (models.py / enums.py)
class Unit(Enum):
    G = "g"; ML = "ml"; TABLESPOON = "tablespoon"; PIECE = "piece"

# Prototype nutrition fields (confirmed correct model):
# kcal, fat, carbohydrates, protein, fiber — all per portion_size in g
# sodium — per portion_size in mg (milligrams, consistent with nutrition label conventions)
```

### Auth Flow
- POST `/auth/register` → creates user, returns access + refresh tokens
- POST `/auth/login` → validates credentials, returns access + refresh tokens
- POST `/auth/refresh` → validates refresh token hash in DB, returns new access token
- POST `/auth/logout` → revokes refresh token in DB
- Access token: 15-minute expiry, RS256 or HS256 signed JWT
- Refresh token: 7-day expiry, stored as bcrypt hash in DB (not plaintext)
- Rate limiting: 5 failed login attempts per IP per minute (fastapi-limiter + Redis or in-memory)
- Passwords: minimum 8 characters, bcrypt cost factor ≥ 12

### Ingredient Search API
- GET `/ingredients/search?q=chicken&limit=20` — returns system ingredients + calling user's private ingredients, ranked by relevance (prefix match first, then substring)
- GET `/ingredients/{id}` — full detail for one ingredient
- POST `/ingredients` — create user custom ingredient
- PATCH `/ingredients/{id}` — update own ingredient (or any if admin)
- DELETE `/ingredients/{id}` — delete own ingredient (or any if admin)
- POST `/ingredients/{id}/promote` — user submits promotion request
- GET `/admin/ingredients/promotions` — admin: list pending promotions
- POST `/admin/ingredients/promotions/{id}/approve` — admin: approve → set is_system=true, owner_id=null
- POST `/admin/ingredients/promotions/{id}/reject` — admin: reject with note

### Seed Script
- Source: Open Food Facts CSV export, filtered to entries with complete macro data (kcal, protein, fat, carbs, fiber, sodium) and common units
- Target: ~500–1000 high-quality entries covering common cooking ingredients, produce, proteins, grains, condiments, dairy
- The prototype's 38-item JSON (`default_ingredients.json`) is merged into the seed as a curated override layer (it has verified, hand-checked values)
- Script is idempotent: re-running it does not duplicate entries (upsert by normalised name + unit)

### Frontend Architecture
- Single-page app with React Router (or TanStack Router) for client-side routing
- **Navigation: 5-tab bottom bar** (mobile-first, always visible):

  | Tab | Label | Route | Notes |
  |-----|-------|-------|-------|
  | 1 | Log | `/` | Default home — today's daily log |
  | 2 | Recipes | `/recipes` | Recipe list + cooking mode |
  | 3 | Pantry | `/pantry` | Pantry list; carries expiring-soon badge |
  | 4 | History | `/history` | Calendar + weekly strip (PRD 04) |
  | 5 | Profile | `/profile` | Macro targets + account + logout |

  All routes under `/admin/*` are outside the tab bar and only accessible to admin users.
- Auth state in a React context: access token stored **in memory only** (never localStorage — XSS risk); refresh token stored in an `httpOnly` cookie via the API
- shadcn/ui Combobox component as the ingredient search input — supports async search, keyboard navigation, mobile tap targets
- All UI/component work to be implemented following the **frontend-design skill** for aesthetic direction and implementation quality

## Testing Decisions

### What makes a good test here
Test external behaviour only: API contracts, business logic outputs, auth flows. Do not test internal implementation details like ORM query structure or React component internals.

### Backend (pytest + pytest-asyncio)
- Auth: registration happy path, duplicate username/email rejection, login success, login failure (wrong password), rate limiting trigger, token refresh, logout + revocation, expired token rejection
- Ingredient search: returns system + user ingredients, does not return other users' private ingredients, admin can see all
- Ingredient CRUD: create, read, update (own only), delete (own only), admin can modify system ingredients
- Promotion flow: submit, admin approve, admin reject
- All tests use a dedicated test PostgreSQL database (separate DB name, seeded in fixtures)

### Frontend (Jest + React Testing Library)
- Ingredient search combobox: typing triggers search, results render, selecting an item populates the form
- Auth forms: validation errors show, successful login stores token and redirects

### Out of Scope for this PRD
- Recipe calculator feature (PRD 01)
- Meal logging (PRD 02)
- Pantry (PRD 03)
- History/calendar view (PRD 04)
- OAuth / social login
- Email verification / password reset
- Barcode scanning
- Mobile native app

## Further Notes

- The Open Food Facts dataset is licensed CC BY-SA 4.0 — acceptable for this use case. Attribution should be noted in the app's about/footer.
- When generating the API client from the OpenAPI schema, add this as a `pnpm` script (`pnpm run gen:api`) so it can be re-run whenever the backend schema changes.
- Alembic migrations should be committed alongside model changes — no auto-migration in production startup.
- The Docker Compose setup should include a `pgweb` service (or similar) for local DB inspection during development, but excluded from the production compose file.
- Consider `slowapi` (FastAPI rate limiting) backed by an in-memory store for dev and Redis for production.
