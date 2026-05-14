# 03-05 · Pantry Enhancements Backend — Storage Location Filter

**Type:** AFK
**Blocked by:** 03-01

---

## What to build

Extend the pantry API with a storage location filter parameter so the frontend can request only items from a specific location. The `storage_location` field is already in the schema from 03-01; this slice makes it queryable.

Change to existing endpoint:
```
GET /pantry?location=fridge     — returns only items where storage_location = 'fridge'
GET /pantry?location=freezer    — returns only items where storage_location = 'freezer'
GET /pantry?location=pantry     — returns only items where storage_location = 'pantry'
GET /pantry?location=other      — returns only items where storage_location = 'other'
GET /pantry                      — (no param) returns all items, unchanged behaviour
```

The filter is applied **before** the sort — the sort order (expiry ASC, then created_at DESC) still applies within the filtered set.

The `GET /pantry/expiring?days=N` endpoint from 03-01 should also respect the `?location=` filter if both params are provided (optional enhancement, acceptable to skip for this slice).

## Acceptance criteria

- [ ] `GET /pantry?location=fridge` returns only items with `storage_location = 'fridge'`
- [ ] `GET /pantry?location=freezer` returns only freezer items
- [ ] `GET /pantry?location=pantry` returns only pantry/cupboard items
- [ ] `GET /pantry?location=other` returns only items with `other` location
- [ ] `GET /pantry` (no param) returns all items, unchanged from 03-01 behaviour
- [ ] Filter results are still sorted in the correct order (expiry ASC, nulls last)
- [ ] An invalid `location` value returns HTTP 422 with a clear validation error
- [ ] Filter applies only to the calling user's items (access control unchanged)
- [ ] All filter behaviours are covered by automated tests

## Blocked by

- 03-01 (pantry core backend — `storage_location` field must already exist in the schema)
