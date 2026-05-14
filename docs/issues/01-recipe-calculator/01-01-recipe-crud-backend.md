# 01-01 · Recipe CRUD Backend — Schema, Migrations, API, Tests

**Type:** AFK
**Blocked by:** 00-06

---

## What to build

Implement the recipe data model and the full CRUD API for recipe management. Recipes are user-owned templates — they store ingredient lists and metadata but **no pre-computed nutrition values** (nutrition is always calculated at cook-time).

Schema introduced:
```
Recipe:
  id, owner_id (FK → User),
  name, description,
  last_cooked_at (datetime, nullable),
  last_cooked_weight_g (float, nullable),
  created_at, updated_at

RecipeIngredient:
  id, recipe_id (FK), ingredient_id (FK),
  amount (float),        -- in the ingredient's own unit
  display_order (int)
```

Endpoints:
```
GET    /recipes                     — list user's recipes, sorted by last_cooked_at DESC (nulls last, then by name)
POST   /recipes                     — create recipe with name, description, and ingredients list
GET    /recipes/{id}                — recipe detail with full ingredient list
PATCH  /recipes/{id}                — update name/description; replace the full ingredient
                                      list (delete all existing RecipeIngredient rows for
                                      this recipe, then reinsert from the submitted list);
                                      client always sends the complete ingredient list
DELETE /recipes/{id}                — delete recipe and its RecipeIngredient rows
POST   /recipes/{id}/duplicate      — copy recipe (new name = "Copy of <name>"), return new recipe id
```

Access rule: a user may only read/modify their own recipes. Accessing another user's recipe returns HTTP 404.

## Acceptance criteria

- [ ] Alembic migrations for `recipes` and `recipe_ingredients` apply cleanly
- [ ] `POST /recipes` creates a recipe with ingredients; `GET /recipes/{id}` returns the full ingredient list in display order
- [ ] `GET /recipes` returns only the calling user's recipes, sorted by `last_cooked_at DESC` (never-cooked recipes at the end, sorted by name)
- [ ] `PATCH /recipes/{id}` can update name/description and replace the full ingredient list (delete-all existing `RecipeIngredient` rows + reinsert from the submitted list)
- [ ] `DELETE /recipes/{id}` removes the recipe and all its `RecipeIngredient` rows
- [ ] `POST /recipes/{id}/duplicate` creates a new recipe with the same ingredients; original is unchanged
- [ ] Requesting another user's recipe via any endpoint returns HTTP 404
- [ ] Requesting a recipe with an ingredient that belongs to another user returns HTTP 400 (cannot embed someone else's private ingredient)
- [ ] All CRUD operations and access-control rules are covered by automated tests

## Blocked by

- 00-06 (ingredient search API — `RecipeIngredient` has a FK to `Ingredient`)
