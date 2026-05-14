# 00-01 · Project Scaffold — Docker Compose, FastAPI, React, Alembic, Pre-commit

**Type:** AFK
**Blocked by:** None — can start immediately

---

## What to build

Bootstrap the full-stack project skeleton so every subsequent slice has a working, reproducible local environment to build on. This slice produces no user-facing features — it is the foundation every other issue depends on.

The scaffold covers:
- **Docker Compose** (`docker-compose.yml`) wiring three services: `api` (FastAPI), `frontend` (Vite dev server), `db` (PostgreSQL 16). A `pgweb` service for local DB inspection is included in the dev compose only.
- **FastAPI app** (`/api`) — bare Python 3.12 project with `pyproject.toml`, a `/health` endpoint, SQLAlchemy 2.0 async engine configured, and Alembic initialised with a first empty migration.
- **React app** (`/frontend`) — TypeScript, Vite, pnpm, shadcn/ui scaffolded, Tailwind CSS configured, Jest + React Testing Library configured.
- **Environment config** — `.env.example` committed with all required variable names documented; `.env` gitignored.
- **Pre-commit hooks** — ruff (lint + format), eslint, prettier, mypy, tsc all wired via `pre-commit` config.
- **API client codegen** — `pnpm run gen:api` script configured (using `hey-api/openapi-ts`) pointing at FastAPI's `/openapi.json`. Not yet used — just wired.
- **README** — single `docker compose up` onboarding instruction verified.

## Acceptance criteria

- [ ] `docker compose up` starts all three services (api, frontend, db) without error
- [ ] `GET /health` returns `{"status": "ok"}` with HTTP 200
- [ ] React SPA renders a placeholder page at `http://localhost:5173`
- [ ] `alembic upgrade head` runs the initial (empty) migration without error
- [ ] `docker compose run api alembic upgrade head` works inside the container
- [ ] Hot-reload is configured for BOTH backend and frontend, so files can be edited while the containers are running, and the result is immediately visible
- [ ] `.env.example` documents every required environment variable
- [ ] `pre-commit run --all-files` passes on a clean checkout
- [ ] `pnpm run gen:api` runs without error (generates an empty client from the bare OpenAPI schema)
- [ ] `pgweb` service starts and connects to the `db` service in the dev compose
- [ ] `pgweb` service is absent from any production compose file

## Blocked by

None — can start immediately
