# 03-01 · Pantry Core Backend — Schema, Migration, CRUD, Sort, Expiring Endpoint

**Type:** AFK
**Blocked by:** 00-02

---

## What to build

Implement the pantry inventory data model and the full CRUD API. The pantry is an intentionally simple feature: users log what they have in stock with a quantity and optional expiry date.

Schema introduced:
```
PantryItem:
  id, user_id (FK → User),
  name (str),                         -- free-text display name (always stored independently)
  ingredient_id (FK nullable),        -- optional link to ingredient DB
  quantity (float),
  unit (str),                         -- free-text unit
  expiry_date (date, nullable),
  storage_location (enum: fridge | freezer | pantry | other, default: pantry),
  notes (str, nullable),
  created_at, updated_at
```

The `ingredient_id` link is optional — a user should never be blocked by a missing ingredient record. When provided, `name` is still stored independently so renaming an ingredient never corrupts the pantry.

Default sort order (applied server-side):
1. Items with `expiry_date IS NOT NULL`, sorted by `expiry_date ASC` (soonest first)
2. Items with `expiry_date IS NULL`, sorted by `created_at DESC`

Endpoints:
```
GET    /pantry                      — list all user's pantry items (sorted as above)
POST   /pantry                      — create pantry item
PATCH  /pantry/{id}                 — update quantity, expiry_date, notes, storage_location, or unit
DELETE /pantry/{id}                 — delete item
GET    /pantry/expiring?days=3      — items with expiry_date within the next N days (inclusive of today)
```

## Acceptance criteria

- [ ] Alembic migration for `pantry_items` table applies cleanly
- [ ] `POST /pantry` creates an item; `ingredient_id` is optional (free-text-only items accepted)
- [ ] `GET /pantry` returns items sorted: dated items by expiry ASC, undated items by created_at DESC
- [ ] Items past their expiry date appear at the top (most negative days first)
- [ ] `PATCH /pantry/{id}` can update any mutable field
- [ ] `DELETE /pantry/{id}` removes the item
- [ ] `GET /pantry/expiring?days=3` returns only items with `expiry_date` within the next 3 days (including today, including already-expired items if N allows)
- [ ] User A cannot read or modify User B's pantry items (HTTP 404)
- [ ] All endpoints require authentication (HTTP 401 for unauthenticated requests)
- [ ] All sort logic and access-control rules are covered by automated tests

## Blocked by

- 00-02 (auth backend — all pantry endpoints require authentication)
