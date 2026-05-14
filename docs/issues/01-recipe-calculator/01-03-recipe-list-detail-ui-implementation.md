# 01-03 · Recipe List & Detail UI Implementation

**Type:** HITL
**Blocked by:** 01-02

---

## What to build

Implement the recipe list screen and the read-only recipe detail view in React, following the approved prototype from 01-02. The create/edit form is a separate slice (01-04); this slice focuses on browsing and reading recipes.

This slice covers:
- **Recipe list screen** (`/recipes`)
  - Fetches from `GET /recipes`
  - Cards: recipe name, last cooked date ("Not cooked yet" if null), ingredient count, last per-100g kcal
  - Sort: most recently cooked first; never-cooked recipes alphabetically at the bottom
  - Search bar: client-side filter on loaded recipe names (no separate API call needed)
  - FAB → navigates to create form (01-04)
  - Swipe-to-delete: calls `DELETE /recipes/{id}`; undo toast (5s window restores via re-creation or soft-delete depending on implementation)
  - Empty state: "No recipes yet" + CTA to create
- **Recipe detail view** (`/recipes/{id}`)
  - Fetches from `GET /recipes/{id}`
  - Ingredient list in display order with amounts
  - Last cooked date and last per-100g nutrition panel (shown only if `last_cooked_at` is set)
  - "Start Cooking" button → navigates to Cooking Mode (01-07, can be a placeholder link for now)
  - "Edit" button → navigates to edit form (01-04)

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Recipe list loads from `GET /recipes` and renders cards with all four data points
- [ ] Search bar filters the visible recipe cards in real time
- [ ] FAB is visible without scrolling on the list and navigates to the create route
- [ ] Swipe-to-delete removes the card immediately (optimistic); undo toast appears for 5 seconds
- [ ] Empty state renders when no recipes exist
- [ ] Recipe detail view loads from `GET /recipes/{id}` and shows ingredient list in display order
- [ ] Last per-100g nutrition panel is hidden when recipe has never been cooked
- [ ] "Start Cooking" button is present (links to Cooking Mode — placeholder is acceptable)
- [ ] "Edit" button navigates to the edit form
- [ ] Both screens are correct at 375px and 1280px
- [ ] PR reviewed and approved by owner

## Blocked by

- 01-02 (approved recipe management UI prototype)
