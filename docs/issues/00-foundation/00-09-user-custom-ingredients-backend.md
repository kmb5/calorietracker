# 00-09 · User Custom Ingredients Backend — CRUD & Promotion Request

**Type:** AFK
**Blocked by:** 00-06

---

## What to build

Add write endpoints so authenticated users can create, edit, and delete their own private custom ingredients, and submit a promotion request to have an ingredient added to the shared system database.

Endpoints added:
```
POST   /ingredients                   — create custom ingredient (owner_id = calling user)
PATCH  /ingredients/{id}              — update own ingredient (or any if admin)
DELETE /ingredients/{id}              — delete own ingredient (or any if admin)
POST   /ingredients/{id}/promote      — set is_promotion_pending=true on own ingredient
```

Access rules:
- A user can only PATCH/DELETE ingredients they own
- Attempting to modify another user's ingredient returns HTTP 404 (not 403, to avoid information leakage)
- An admin can modify or delete any ingredient, including system ingredients
- `POST /ingredients` always creates with `is_system=false` and `owner_id = calling user` — users cannot self-assign `is_system=true`
- A user cannot promote an ingredient they don't own

Fields accepted on create/update: `name`, `unit`, `portion_size`, `kcal`, `protein`, `fat`, `carbohydrates`, `fiber`, `sodium`.

## Acceptance criteria

- [ ] `POST /ingredients` creates a custom ingredient with `is_system=false` and `owner_id` set to the calling user
- [ ] The new ingredient appears in the calling user's `GET /ingredients/search` results
- [ ] The new ingredient does **not** appear in another user's search results
- [ ] `PATCH /ingredients/{id}` updates the ingredient when called by the owner
- [ ] `PATCH /ingredients/{id}` by a non-owner returns HTTP 404
- [ ] `DELETE /ingredients/{id}` removes the ingredient when called by the owner
- [ ] `DELETE /ingredients/{id}` by a non-owner returns HTTP 404
- [ ] `POST /ingredients/{id}/promote` sets `is_promotion_pending=true`; calling it again is idempotent
- [ ] An admin user can PATCH or DELETE any ingredient (system or custom)
- [ ] All rules are covered by automated tests

## Blocked by

- 00-06 (ingredient search API — shares the Ingredient model and access-control patterns)
