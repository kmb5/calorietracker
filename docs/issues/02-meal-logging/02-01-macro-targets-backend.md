# 02-01 · Macro Targets Backend — Schema, Migration, GET/PUT /users/me/targets

**Type:** AFK
**Blocked by:** 00-02

---

## What to build

Implement the user macro targets feature: a single per-user record storing optional daily goals for kcal, protein, fat, carbohydrates, fiber, and sodium. The record is upserted (created on first save, updated on subsequent saves).

Schema introduced:
```
MacroTarget:
  id, user_id (FK → User, unique index),
  kcal_target (float, nullable),
  protein_g_target (float, nullable),
  fat_g_target (float, nullable),
  carbohydrates_g_target (float, nullable),
  fiber_g_target (float, nullable),
  sodium_mg_target (float, nullable),
  updated_at
```

Endpoints:
```
GET /users/me/targets   — returns the calling user's MacroTarget row (nulls for unset fields)
PUT /users/me/targets   — upserts all target fields; accepts partial updates (omitted fields become null)
```

All fields are nullable — a user may set only a kcal target if that's all they care about. The GET endpoint always returns a response (with null fields) even if the user has never saved targets.

## Acceptance criteria

- [ ] Alembic migration for `macro_targets` table applies cleanly
- [ ] `GET /users/me/targets` returns a response with all six fields (nulls for a user who has never set targets)
- [ ] `PUT /users/me/targets` creates the row when one does not exist
- [ ] `PUT /users/me/targets` updates the existing row when one does exist
- [ ] Omitting a field in the PUT body sets that field to null (full replacement semantics)
- [ ] `GET /users/me/targets` for user A never returns user B's targets
- [ ] Both endpoints require authentication (HTTP 401 for unauthenticated requests)
- [ ] Upsert is idempotent: calling PUT twice with the same values produces one row, not two
- [ ] All behaviours are covered by automated tests

## Blocked by

- 00-02 (auth backend — endpoints require authenticated user context)
