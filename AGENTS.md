# CalorieTracker v3 — Agent Context

## What This Project Is

CalorieTracker v3 is a personal, mobile-first web app for home cooks who want to track the nutritional content of what they cook and eat. The **hero feature** is the Recipe Calculator: define a recipe template, enter the real cooked weight at cook-time, and get accurate per-100g nutrition (accounting for weight lost during cooking). You then portion by weight and log to your daily diary in one tap.

**Three pillars:**
1. **Recipe Calculator** — define recipes, cook with live nutrition calc, log portions
2. **Meal Log** — daily diary by meal type with macro progress against configurable targets
3. **Pantry** — lightweight fridge/pantry inventory sorted by expiry date

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, pnpm, shadcn/ui, Tailwind CSS, Jest + Testing Library |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| Database | PostgreSQL 16 |
| Auth | bcrypt (cost ≥ 12) + JWT (15 min access / 7 day refresh); refresh tokens hashed in DB |
| Containers | Docker + Docker Compose |
| API Client | `hey-api/openapi-ts` — generated TypeScript client at `frontend/src/client/` |
| Deployment | VPS (Hetzner / DigitalOcean) |

## Repository Layout

```
/
├── api/                  FastAPI application
│   ├── app/              Source (main.py, config.py, database.py, ...)
│   ├── tests/            pytest test suite
│   ├── alembic/          Migrations
│   └── pyproject.toml
├── frontend/             React application
│   ├── src/
│   │   ├── client/       Generated API client (do NOT hand-edit)
│   │   └── ...
│   └── package.json
├── docs/
│   ├── issues/           Issue source files (already migrated to GitHub)
│   └── *.md              PRDs
├── scripts/              Utility scripts (e.g. migrate-issues.sh)
├── docker-compose.yml    Dev stack
├── docker-compose.prod.yml
├── .pre-commit-config.yaml
└── AGENTS.md             ← this file
```

## Local Development

```bash
# First-time setup
cp .env.example .env            # defaults work out-of-the-box
cd api && uv sync --frozen --all-extras && cd ..   # API venv (for local tooling)
pnpm --prefix frontend install  # Frontend deps (for local tooling)

# Start everything
docker compose up

# Run initial migration
docker compose run --rm api alembic upgrade head

# Regenerate TypeScript API client (API must be running)
pnpm --prefix frontend run gen:api
```

| Service  | URL                        | Notes |
|----------|----------------------------|-------|
| API      | http://localhost:8000      | FastAPI + hot-reload |
| Docs     | http://localhost:8000/docs | Swagger UI |
| Frontend | http://localhost:5173      | Vite + HMR |
| pgweb    | http://localhost:8081      | DB inspector (dev only) |

## Key Commands

### Backend

```bash
# Type-check
cd api && .venv/bin/ty check app/

# Lint + format
cd api && .venv/bin/ruff check --fix app/ && .venv/bin/ruff format app/

# Tests
cd api && .venv/bin/pytest

# New migration (after editing models)
docker compose run --rm api alembic revision --autogenerate -m "<description>"
docker compose run --rm api alembic upgrade head
```

### Frontend

```bash
pnpm --prefix frontend run type-check   # tsc --noEmit
pnpm --prefix frontend run lint         # eslint
pnpm --prefix frontend run format       # prettier
pnpm --prefix frontend run test         # jest
pnpm --prefix frontend run build        # production build
pnpm --prefix frontend run gen:api      # regenerate API client
```

### Pre-commit (runs all checks)

```bash
pre-commit run --all-files
```

---

## Working with Issues

All 45 project issues live on **GitHub**: https://github.com/kmb5/calorietracker/issues

Use the `gh` CLI to interact with them — never edit `docs/issues/` files directly; they are the canonical source that was used to seed GitHub and are now read-only.

### Fetch and read an issue

```bash
gh issue list --repo kmb5/calorietracker --limit 50
gh issue view <number> --repo kmb5/calorietracker
```

### Issue labels

| Label | Meaning |
|---|---|
| `AFK` | Agent-executable — implement autonomously without human review |
| `HITL` | Human-in-the-loop — requires human review / approval before proceeding |
| `prd:00-foundation` … `prd:04-history` | Which PRD the issue belongs to |

### One issue = one branch = one pull request

Workflow for every issue:

```bash
# 1. Start from an up-to-date main
git checkout main && git pull

# 2. Create a branch named after the issue number and slug
#    Pattern: issue/<number>-<short-slug>
#    Example for issue #15:
git checkout -b issue/15-recipe-crud-backend

# 3. Implement the issue (see implementation style below)

# 4. Commit with a message referencing the issue
git commit -m "feat: recipe CRUD backend (#15)"

# 5. Push and open a PR — link the issue so it auto-closes on merge
gh pr create \
  --repo kmb5/calorietracker \
  --title "<title from issue>" \
  --body "Closes #<number>" \
  --label "<AFK or HITL>"
```

Branch naming: `issue/<github-issue-number>-<kebab-slug>`
PR title: mirrors the GitHub issue title exactly.
PR body: must contain `Closes #<number>` so the issue closes on merge.

### Checking dependencies before starting

Each issue lists what it is **blocked by**. Check those issues are merged to `main` before beginning:

```bash
gh issue view <number> --repo kmb5/calorietracker   # read the "Blocked by" section
gh pr list --repo kmb5/calorietracker --state merged  # confirm blockers are merged
```

---

## Implementation Style

- **Work incrementally**: implement one logical piece, then run a verification command (build, lint, test, or health check) before moving on.
- **Do not plan the entire solution up front** — begin writing after a brief analysis (3–5 bullets max).
- **After each significant file group**, pause and run the relevant check (`docker compose build api`, `pnpm tsc --noEmit`, `pytest`, `ruff check .`).
- **If a check fails, fix it immediately** before writing the next piece.
- **Prefer many small focused edits** over one large batch of writes.
- **Frontend + backend**: wire up and verify one end before starting the other.

## API Client Generation

**Always regenerate the TypeScript client before writing any frontend code that calls the API.** The generated client at `frontend/src/client/` is the authoritative source of types and service functions — never hand-write fetch calls or duplicate types that already exist there.

```bash
# API must be running first
docker compose up -d
pnpm --prefix frontend run gen:api
```

The client is committed to the repo — it must be kept in sync with the live API. In code, import directly from the generated modules:

```ts
import { loginAuthLoginPost } from "../client/services.gen";
import type { LoginRequest, TokenResponse } from "../client/types.gen";
```

Errors thrown by the generated client are instances of `ApiError` (from `../client/core/ApiError`) with a `.status` number and `.body` payload — use `instanceof ApiError` to handle them.

---

## Key Design Decisions

1. **Recipe Calculator is the hero feature** — optimise Cooking Mode for one-handed mobile use while actively standing at a stove.
2. **Nutrition is snapshotted at log time** — changing an ingredient's values never retroactively alters past meal logs.
3. **Recipes are templates only** — no pre-computed nutrition stored on the recipe. Cooked weight is entered at cook-time; nutrition is calculated on the fly.
4. **Ingredient DB is two-tier** — system ingredients (seeded from Open Food Facts, admin-managed) and user custom ingredients (private by default, admin-promotable to system).
5. **Pantry is intentionally simple** — inventory + expiry date only; no recipe integration in v1.
6. **History is a backburner feature** — PRD 02 data model already captures everything needed; no schema changes required.
7. **Never hand-edit `frontend/src/client/`** — that directory is fully generated by `gen:api`. Regenerate it after any API schema change.

## Frontend UI Work

Always invoke the **frontend-design skill** when implementing any UI issue. It ensures production-grade, mobile-first components that match the app's design language.

## Code Conventions

### Python / Backend
- Use `async`/`await` throughout — no synchronous DB calls
- SQLAlchemy 2.0 style (`select()`, `session.execute()`, no legacy `Query` API)
- Pydantic v2 models for all request/response schemas
- All endpoints require auth unless explicitly public (`/health`, `/auth/*`)
- Return HTTP 404 (not 403) when a user requests another user's resource — don't reveal existence
- Access token: 15 min expiry; refresh token: 7 days, hashed in DB with bcrypt

### TypeScript / Frontend
- Strict TypeScript — no `any`, no `@ts-ignore` without a comment explaining why
- Use the generated API client (`frontend/src/client/`) for all API calls
- shadcn/ui components for all UI primitives; extend with Tailwind utility classes
- Mobile-first: design for 375px viewport, then scale up
- All new components go under `frontend/src/components/`; screens under `frontend/src/pages/`

### Frontend Testing

**Every frontend issue must ship tests alongside the implementation.** The test suite runs in CI (`pnpm run test`) and must stay green.

#### What to test

| Unit | What to cover |
|---|---|
| Context / hooks | All state transitions: happy path, error path, loading state, edge cases (e.g. expired token, API down) |
| Pages | Form validation (client-side), successful submit → navigation, each distinct API error message, loading/disabled state during request |
| Route guards | Authenticated → renders content; unauthenticated → redirects; `loading=true` → spinner, no redirect |
| Pure utils | All branches of any non-trivial logic (e.g. `calcStrength`, formatters) |

**Do not test:** implementation details (internal state shape, exact hook call counts), visual styling, or icon rendering.

#### How to structure tests

- One `*.test.tsx` / `*.test.ts` file per source file, co-located next to the file it tests.
- Use `jest.mock("../services/auth")` (or the relevant service module) to avoid real HTTP in every test.
- Mock `useAuth` at the module level when testing pages/components that consume it — never render a real `AuthProvider` in page tests.
- Wrap async state changes in `act()` or use `waitFor()` / `findBy*` queries.
- Prefer `getByRole` and `getByLabelText` over `getByTestId`; use exact label strings (e.g. `getByLabelText("Password")`) when a fuzzy regex would match multiple elements.

#### Constructing an `ApiError` in tests

```ts
import { ApiError } from "../client/core/ApiError";

const err = new ApiError(
  { method: "POST", url: "/auth/login" },
  { url: "/auth/login", ok: false, status: 401, statusText: "Unauthorized", body: {} },
  "Unauthorized"
);
```

#### Running tests

```bash
pnpm --prefix frontend run test          # run once
pnpm --prefix frontend run test:watch    # watch mode during development
```
