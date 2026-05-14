# 00-06 · Ingredient Search API — Search, Detail, Access Control

**Type:** AFK
**Blocked by:** 00-02, 00-05

---

## What to build

Expose the ingredient database via two read endpoints and the foundational access-control rule that governs all ingredient visibility: authenticated users see system ingredients plus their own private custom ingredients, never other users' private ingredients.

Endpoints:
```
GET /ingredients/search?q=<term>&limit=20   — search by name
GET /ingredients/{id}                        — full detail for one ingredient
```

Search ranking:
1. Prefix matches (name starts with query) — ranked first
2. Substring matches — ranked second
3. System ingredients and the calling user's own custom ingredients are merged into a single result set
4. Another user's `is_system=false` ingredient must never appear in results

The `unit` filter query param (`?unit=g`) is supported to narrow results by unit type.

This slice does **not** include write endpoints for custom ingredients (that is 00-09) — only the read path needed by 00-07 (UI prototype) and downstream recipe/logging features.

## Acceptance criteria

- [ ] `GET /ingredients/search?q=chicken` returns matching system ingredients for an authenticated user
- [ ] Results include the calling user's own custom ingredients (mixed with system results)
- [ ] Results do **not** include another user's private (`is_system=false`) ingredients
- [ ] Prefix matches appear before substring matches in the result list
- [ ] `?unit=g` filter returns only gram-based ingredients
- [ ] Each result item includes: `id`, `name`, `unit`, `portion_size`, `kcal`
- [ ] `GET /ingredients/{id}` returns full detail: all 6 nutrition fields, `is_system`, `owner_id`
- [ ] An unauthenticated request to either endpoint returns HTTP 401
- [ ] `GET /ingredients/{id}` for another user's private ingredient returns HTTP 404 (not 403)
- [ ] All access-control rules are covered by automated tests

## Blocked by

- 00-02 (auth backend — authentication required on all ingredient endpoints)
- 00-05 (ingredient DB seed — system ingredients must exist for search to be meaningful)
