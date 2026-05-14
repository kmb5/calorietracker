# 02-02 · Meal Log Backend — Schema, Migrations, Core CRUD & Nutrition Snapshot

**Type:** AFK
**Blocked by:** 00-05, 01-01

---

## What to build

Implement the meal log data model and the core read/write API. This is the backbone of the daily food diary: every log entry snapshots nutrition at write time so historical records are never affected by later changes to ingredient data.

Schema introduced:
```
MealLog:
  id, user_id (FK),
  logged_date (date),        -- calendar date, NOT datetime (avoids timezone issues)
  meal_type (enum: breakfast | lunch | dinner | snack),
  name (str, nullable),      -- auto-set from recipe/ingredient name
  notes (str, nullable),
  created_at

MealLogEntry:
  id, meal_log_id (FK),
  ingredient_id (FK, nullable),   -- null for recipe-based entries
  recipe_id (FK, nullable),       -- null for ingredient-based entries
  amount_g (float),               -- weight consumed
  -- Snapshotted nutrition (immutable after creation):
  kcal (float),
  protein_g (float),
  fat_g (float),
  carbohydrates_g (float),
  fiber_g (float),
  sodium_g (float)
```

For recipe portions, one `MealLogEntry` row is created **per recipe ingredient**, each holding its proportional nutrition snapshot.

Endpoints:
```
GET  /logs?date=YYYY-MM-DD       — all MealLogs + entries for a day (user's own only)
POST /logs                        — create a MealLog with one or more MealLogEntry rows
GET  /logs/summary?date=YYYY-MM-DD — daily macro totals (sum of all entries)
```

## Acceptance criteria

- [ ] Alembic migrations for `meal_logs` and `meal_log_entries` tables apply cleanly
- [ ] `POST /logs` creates a `MealLog` with entries; nutrition values are snapshotted at write time
- [ ] For a recipe portion log, one `MealLogEntry` row is created per recipe ingredient
- [ ] `GET /logs?date=` returns all logs and entries for that calendar date (user's own only)
- [ ] `GET /logs?date=` for a date with no entries returns an empty list (not an error)
- [ ] `GET /logs/summary?date=` returns correct summed totals across all entries for the day
- [ ] `GET /logs/summary?date=` returns zero-valued fields for a day with no entries
- [ ] **Snapshot immutability**: updating an ingredient's kcal value does NOT change an existing `MealLogEntry`
- [ ] User A cannot read User B's logs via any endpoint (HTTP 404)
- [ ] `logged_date` is stored as a `date` type, not `datetime`
- [ ] All behaviours are covered by automated tests

## Blocked by

- 00-05 (ingredient DB seed — `MealLogEntry` references the `Ingredient` schema)
- 01-01 (recipe CRUD backend — `MealLogEntry` references the `Recipe` schema)
