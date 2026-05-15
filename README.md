# CalorieTracker v3

## Getting Started (Local Development)

```bash
# 1. Copy env vars and fill in values (defaults work out-of-the-box)
cp .env.example .env

# 2. Create the API virtualenv (needed for local tooling: ty, pytest)
cd api && uv sync --frozen --all-extras && cd ..

# 3. Install frontend deps (needed for local tooling: eslint, prettier, tsc)
pnpm --prefix frontend install

# 4. Start everything
docker compose up
```

| Service  | URL                          | Notes                    |
|----------|------------------------------|---------------------------|
| API      | http://localhost:8000        | FastAPI + hot-reload      |
| Docs     | http://localhost:8000/docs   | Swagger UI                |
| Frontend | http://localhost:5173        | Vite dev server + HMR     |
| pgweb    | http://localhost:8081        | DB inspector (dev only)   |

```bash
# Run the initial migration (also works inside Docker)
docker compose run --rm api alembic upgrade head

# Generate the TypeScript API client (API must be running)
pnpm --prefix frontend run gen:api

# Run all pre-commit checks
pre-commit run --all-files
```

---

# PRD Index

## What We're Building

CalorieTracker v3 is a personal, mobile-first web application for home cooks who want to track the nutritional content of what they cook and eat — accurately, without fuss.

The core problem it solves: when you cook a batch meal from scratch, the nutrition of the finished dish is not the same as the sum of raw ingredients. Weight changes during cooking (evaporation, rendering, reduction). CalorieTracker handles this correctly: you define a recipe as a list of ingredients, then at cook-time you enter the actual total cooked weight and the app calculates accurate per-100g nutrition on the spot. You then portion out the food by weight and log what you ate.

**The three pillars:**

1. **Recipe Calculator** — The hero feature. Define reusable recipe templates (ingredients + quantities). At cook-time, enter the real cooked weight → get live per-100g nutrition for kcal, protein, fat, carbs, fiber, sodium. Portion by weight → log to your diary in one tap.

2. **Meal Log** — A daily food diary organised by meal type (Breakfast / Lunch / Dinner / Snack). Log portions of saved recipes or individual ingredients ad-hoc. Track progress against configurable daily macro targets with visual progress indicators.

3. **Pantry** — A lightweight fridge/pantry inventory. Log what you have in stock with quantities and expiry dates. Items sort by soonest-to-expire so you always see what needs to be used first.

**Supporting infrastructure:**
- A seeded ingredient database (sourced from Open Food Facts) with ~500–1000 common cooking ingredients, extendable with user-created custom entries
- User accounts with secure authentication (bcrypt + JWT); admin role for curating the shared ingredient database
- Full-stack: React + TypeScript frontend, FastAPI + PostgreSQL backend, Docker Compose for local and production
- A history/calendar view (backlog) showing past logs colour-coded against daily targets

**Who uses it:** primarily a single user or small household. Not a social platform — recipes are private, the pantry is personal. Built to be fast and usable one-handed on a phone while actively standing at a stove.

---

This directory contains the Product Requirements Documents for CalorieTracker v3.

## Document Map

| # | PRD | Priority | Status |
|---|-----|----------|--------|
| [00](./00-foundation.md) | Foundation — Project Setup, Auth, Ingredient DB, Admin | **P0 — Build first** | Ready |
| [01](./01-recipe-calculator.md) | Recipe Calculator — Hero Feature | **P0 — Core feature** | Ready |
| [02](./02-meal-logging.md) | Meal Logging & Daily Macro Tracking | **P1** | Ready |
| [03](./03-pantry.md) | Pantry Inventory | **P2** | Ready |
| [04](./04-history.md) | History & Calendar View | **P3 — Backburner** | Ready |

## Build Order

```
PRD 00 (Foundation)
  └─▶ PRD 01 (Recipe Calculator)   ← hero feature, start here after foundation
        └─▶ PRD 02 (Meal Logging)  ← depends on recipe + ingredient data model
              └─▶ PRD 03 (Pantry)  ← independent, can be parallelised with PRD 02
                    └─▶ PRD 04 (History) ← read-only layer on top of PRD 02 data
```

## Shared Technical Decisions (across all PRDs)

| Concern | Decision |
|---------|----------|
| Frontend | React 18 + TypeScript, pnpm, Vite, Jest + Testing Library |
| UI components | shadcn/ui + Tailwind CSS |
| Frontend UI work | Always invoke **frontend-design skill** |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | PostgreSQL 16 everywhere (Docker) |
| Migrations | Alembic |
| Auth | bcrypt (cost ≥ 12) + JWT (15m access / 7d refresh), refresh tokens hashed in DB |
| Containers | Docker + Docker Compose |
| Deployment target | VPS (Hetzner/DigitalOcean) |

## Key Design Principles

1. **Recipe calculator is the hero feature** — every other feature is secondary. Optimise Cooking Mode for one-handed mobile use while actively cooking.
2. **Nutrition is snapshotted at log time** — changing an ingredient's values never retroactively alters past meal logs.
3. **Recipes are templates only** — no pre-computed nutrition stored. Cooked weight is entered at cook-time.
4. **Ingredient DB is two-tier** — system ingredients (seeded, admin-managed) and user custom ingredients (private by default, admin-promotable).
5. **Pantry is intentionally simple** — inventory + expiry only. No recipe integration in v1.
6. **History is a backburner feature** — PRD 02 data model already captures what's needed; no schema changes required when this is eventually built.
