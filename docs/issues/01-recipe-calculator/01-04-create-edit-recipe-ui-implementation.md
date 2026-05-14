# 01-04 · Create/Edit Recipe UI Implementation

**Type:** HITL
**Blocked by:** 01-02, 00-08

---

## What to build

Implement the create and edit recipe forms in React, following the approved prototype from 01-02. This slice depends on 00-08 (ingredient search combobox) being available, as each ingredient row in the recipe form uses the shared combobox to search and select ingredients.

This slice covers:
- **Create recipe form** (`/recipes/new`)
  - Fields: name (required), description (optional)
  - Ingredient rows: each row has the ingredient search combobox (from 00-08) + a numeric amount input + a remove button
  - "Add ingredient" button appends a new empty row
  - Ingredient rows are reorderable (drag-handle or up/down arrows)
  - Save calls `POST /recipes` with name, description, and ingredients list
  - Cancel navigates back to the recipe list
- **Edit recipe form** (`/recipes/{id}/edit`)
  - Pre-fills from `GET /recipes/{id}`
  - Save calls `PATCH /recipes/{id}` with the **complete ingredient list** (all rows, not a delta); the backend deletes all existing recipe ingredients and reinserts from this list
  - "Delete recipe" danger button → confirmation → `DELETE /recipes/{id}` → navigate to list
  - "Duplicate" button → `POST /recipes/{id}/duplicate` → navigate to edit view of new recipe
- **Validation**: name is required; at least one ingredient is required to save; amount must be > 0

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Create form saves a new recipe via `POST /recipes` and navigates to the recipe detail view
- [ ] Each ingredient row uses the shared combobox from 00-08 to search and select an ingredient
- [ ] Amount inputs are numeric and reject non-positive values
- [ ] "Add ingredient" adds a new empty row
- [ ] Ingredient rows can be removed individually
- [ ] Edit form pre-fills name, description, and all ingredient rows
- [ ] Saving the edit form calls `PATCH /recipes/{id}` and returns to the detail view
- [ ] Delete with confirmation calls `DELETE /recipes/{id}` and navigates to the list
- [ ] "Duplicate" creates a copy and opens it in the edit form
- [ ] Form is usable and correctly laid out at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 01-02 (approved recipe management UI prototype)
- 00-08 (ingredient search combobox — required for ingredient row component)
