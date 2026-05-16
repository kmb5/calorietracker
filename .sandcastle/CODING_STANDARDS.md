# Coding Standards

This is a full-stack app: a **FastAPI + PostgreSQL** backend (`api/`) and a
**React + TypeScript** frontend (`frontend/`). Standards are split by layer.

---

## Repository layout

```
api/        FastAPI app — Python 3.12, uv, ruff, pytest-asyncio
frontend/   React + Vite app — TypeScript strict, pnpm, Jest
```

Never mix concerns across layers (no Python in `frontend/`, no JS in `api/`).

---

## API (Python / FastAPI)

### Style
- Python 3.12. All new code must be compatible with `requires-python = ">=3.12"`.
- Formatting and linting via **ruff** (`ruff check`, `ruff format`). Line length 88.
- Ruff rules in scope: `E, F, I, N, W, UP` — imports sorted, unused imports removed.
- Use type annotations everywhere — function signatures, return types, local variables where non-obvious.
- Prefer `async def` for all route handlers and DB-touching functions (the stack is fully async: asyncpg + SQLAlchemy async).

### Architecture
- Routes live in feature modules under `app/` (e.g. `app/auth/`, `app/ingredients/`).
- SQLAlchemy models live in `app/models/` — one file per domain entity. Re-export from `app/models/__init__.py` so callsite imports stay clean.
- Pydantic schemas (request/response) live in `app/schemas/` — keep them separate from ORM models.
- Dependencies (DB session, current user, etc.) live in `app/deps.py`.
- Settings are managed via `pydantic-settings` in `app/config.py`. Never read `os.environ` directly in app code — use `get_settings()`.
- Database migrations use **Alembic**. Every schema change needs a migration. Never use `Base.metadata.create_all()` in production paths.

### Testing
- Tests live in `api/tests/`. Use **pytest-asyncio** with `asyncio_mode = "auto"`.
- Use the shared fixtures in `conftest.py` — SQLite in-memory test DB, no running Postgres required.
- Test files are named `test_<feature>.py`. Test functions are named `test_<what_it_does>`.
- Use `httpx.AsyncClient` with `ASGITransport` for route-level tests — no live server.
- Every new route must have at least one happy-path test and one error-path test (e.g. 401, 404, 422).
- Run tests with: `cd api && uv run pytest`

### Dependencies
- Add runtime deps to `pyproject.toml` `[project] dependencies`. Add dev deps to `[project.optional-dependencies] dev`.
- Always pin with `uv add <package>` so `uv.lock` stays in sync.

---

## Frontend (React / TypeScript)

### Style
- TypeScript strict mode (`"strict": true`, `noUnusedLocals`, `noUnusedParameters`). No `any` unless absolutely unavoidable and commented.
- React with `react-jsx` transform — no need to import React in every file.
- Prefer named exports over default exports for components and utilities.
- Use `@/` path alias for imports from `src/` (e.g. `import { Foo } from "@/components/Foo"`).
- CSS via Tailwind (inferred from `postcss.config.js` + `components.json`). No inline `style` props unless dynamic values require it.

### Architecture
- Pages live in `src/pages/`. Each page is a top-level route component.
- Shared components live in `src/components/`. UI primitives live in `src/components/ui/`.
- API calls go through the generated client in `src/client/` — never fetch the API directly with raw `fetch`. Regenerate with `pnpm run gen:api` when the API schema changes.
- Business logic that isn't UI goes in `src/hooks/` (custom hooks) or `src/services/`.
- Auth state lives in `src/contexts/` — use the existing context rather than threading props.

### Testing
- Tests use **Jest** + React Testing Library (`jest.config.cjs`, `jest.setup.ts`).
- Test files sit next to the file they test: `Foo.tsx` → `Foo.test.tsx`.
- Test names describe expected behaviour: `"shows error message when login fails"`.
- Every new page and non-trivial component must have at least one test.
- Run tests with: `cd frontend && pnpm test`

### Dependencies
- Use `pnpm add` / `pnpm add -D`. Never use npm or yarn in `frontend/`.
- `src/client/` is generated code — do not edit it manually.

---

## Cross-cutting

- **Never commit secrets.** `.env` files are gitignored. Use `.env.example` for templates.
- **Database changes always come with an Alembic migration.** The frontend's generated client must be regenerated after any API schema change.
- **Both test suites must pass before merging.** Run `cd api && uv run pytest` and `cd frontend && pnpm test`.
- When adding a feature that spans both layers, implement and test the API route first, then regenerate the client, then build the UI.
