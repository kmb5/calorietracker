# 02-03 · Log Entry Management Backend — Edit, Delete, Entry-level Operations

**Type:** AFK
**Blocked by:** 02-02

---

## What to build

Extend the meal log API with the endpoints needed to edit and delete individual log entries and whole meal logs. These endpoints are needed before the entry management UI (02-10) and the "Log this portion" bridge (01-08) can fully function.

Endpoints added:
```
PATCH  /logs/{id}                         — update meal_type or notes on a MealLog
DELETE /logs/{id}                         — delete a MealLog and all its MealLogEntry rows

POST   /logs/{id}/entries                 — add a new MealLogEntry to an existing MealLog
PATCH  /logs/{id}/entries/{entry_id}      — update amount_g; recalculates and replaces the nutrition snapshot
DELETE /logs/{id}/entries/{entry_id}      — remove a single MealLogEntry
```

Recalculation on amount update:
- When `amount_g` changes on a `MealLogEntry`, the nutrition snapshot fields must be recomputed proportionally (new_amount / original_amount × original_nutrition)
- The `ingredient_id` / `recipe_id` linkage is read-only after creation — only the amount changes

Access control: all endpoints return HTTP 404 for another user's logs (never HTTP 403).

## Acceptance criteria

- [ ] `PATCH /logs/{id}` updates `meal_type` and/or `notes` on the parent `MealLog`
- [ ] `DELETE /logs/{id}` removes the `MealLog` and all its `MealLogEntry` rows (cascade)
- [ ] `POST /logs/{id}/entries` adds a new entry to an existing log and snapshots nutrition
- [ ] `PATCH /logs/{id}/entries/{entry_id}` updates `amount_g` and recalculates the nutrition snapshot proportionally
- [ ] `DELETE /logs/{id}/entries/{entry_id}` removes that entry; the parent `MealLog` row remains
- [ ] All endpoints return HTTP 404 for another user's logs
- [ ] All endpoints require authentication (HTTP 401 for unauthenticated requests)
- [ ] After deleting the last `MealLogEntry`, the parent `MealLog` still exists (not auto-deleted)
- [ ] All behaviours are covered by automated tests

## Blocked by

- 02-02 (meal log backend — core schema and CRUD must exist first)
