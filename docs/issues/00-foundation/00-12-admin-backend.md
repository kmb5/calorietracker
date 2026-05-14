# 00-12 · Admin Backend — Promotions, System Ingredient CRUD, Bulk Import, User Management

**Type:** AFK
**Blocked by:** 00-09

---

## What to build

Implement all admin-only API endpoints: reviewing and actioning ingredient promotion requests, managing system ingredients directly, bulk importing ingredients from JSON, and managing user accounts (activate/deactivate, role promotion).

All endpoints in this slice require `role=admin`; non-admin callers receive HTTP 403.

Endpoints:
```
GET  /admin/ingredients/promotions                     — list pending promotion requests
POST /admin/ingredients/promotions/{id}/approve        — set is_system=true, owner_id=null, is_promotion_pending=false
POST /admin/ingredients/promotions/{id}/reject         — set is_promotion_pending=false, store rejection note

POST   /admin/ingredients                              — create a new system ingredient directly
PATCH  /admin/ingredients/{id}                        — edit any ingredient (system or custom)
DELETE /admin/ingredients/{id}                        — delete any ingredient (with guard: cannot delete if referenced by recipe ingredients or log entries)

POST /admin/ingredients/bulk-import                   — accept JSON array matching the Ingredient field schema; idempotent upsert by name+unit

GET    /admin/users                                   — list all users
PATCH  /admin/users/{id}                              — activate or deactivate a user
PATCH  /admin/users/{id}/role                         — set role to admin or user
```

The rejection note on `reject` is stored on the Ingredient row (a nullable `promotion_rejection_note` field) or in a separate audit log — implementor's choice, but the note must be retrievable.

## Acceptance criteria

- [ ] All admin endpoints return HTTP 403 when called by a non-admin user
- [ ] `GET /admin/ingredients/promotions` returns only ingredients with `is_promotion_pending=true`
- [ ] Approving a promotion sets `is_system=true`, `owner_id=null`, `is_promotion_pending=false`; the ingredient now appears in all users' search results
- [ ] Rejecting a promotion sets `is_promotion_pending=false` and stores the rejection note
- [ ] `POST /admin/ingredients` creates a system ingredient (`is_system=true`, `owner_id=null`)
- [ ] `PATCH /admin/ingredients/{id}` can update any ingredient regardless of owner
- [ ] `DELETE /admin/ingredients/{id}` is blocked (HTTP 409) if the ingredient is referenced by any `RecipeIngredient` or `MealLogEntry` row
- [ ] `POST /admin/ingredients/bulk-import` upserts correctly; re-importing the same JSON does not create duplicates
- [ ] `PATCH /admin/users/{id}` can deactivate a user; deactivated user's login returns HTTP 403
- [ ] `PATCH /admin/users/{id}/role` can promote a user to admin
- [ ] All admin rules are covered by automated tests

## Blocked by

- 00-09 (user custom ingredients backend — promotion flow builds on the `is_promotion_pending` field)
