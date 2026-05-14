# 01-02 · Recipe Management UI Prototype — List, Detail, Create/Edit

**Type:** HITL
**Blocked by:** 01-01

---

## What to build

Produce a plain HTML clickable prototype covering the full recipe management area: the recipe list, the read-only recipe detail view, and the create/edit recipe form. Getting the flow and ergonomics approved here means both 01-03 and 01-04 can be built in parallel.

Screens / states to cover:
1. **Recipe list** — cards showing recipe name, last cooked date, ingredient count, last per-100g kcal (or "Not cooked yet"); sorted most-recently-cooked first; search bar at the top; FAB (Floating Action Button) for "New Recipe" on mobile
2. **Recipe list — empty state** — "No recipes yet" with a prominent "Create your first recipe" CTA
3. **Recipe list — swipe hint** — a card in a swiped/deleting state with undo toast
4. **Recipe detail (read-only)** — ingredient list with amounts, last cooked date, last cooked per-100g nutrition panel; "Start Cooking" button (links to Cooking Mode, static in prototype); "Edit" button
5. **Create recipe form** — name, description, ingredient rows (each row: ingredient search combobox placeholder + amount input), "Add ingredient" button, Save / Cancel
6. **Edit recipe form** — same as create but pre-filled with example data; "Delete recipe" danger button

Constraints:
- 375px mobile-first viewport
- FAB must be visible without scrolling on the list view
- Ingredient rows in the form must feel spacious enough to tap on mobile

Deliverable: HTML file(s) committed to `docs/prototypes/recipes/`.

## Acceptance criteria

- [ ] All 6 screens/states are represented and navigable
- [ ] Recipe list cards show all four data points (name, last cooked, ingredient count, kcal)
- [ ] Empty state CTA is clickable and navigates to the create form
- [ ] Swipe-to-delete state with undo toast is shown on a card
- [ ] Recipe detail shows ingredient list + last per-100g nutrition panel
- [ ] Create/edit form shows ingredient rows with amount inputs
- [ ] "Add ingredient" button adds a new empty ingredient row
- [ ] Delete button on edit form shows a confirmation step
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 01-03 and 01-04 begin

## Blocked by

- 01-01 (recipe CRUD backend — so the prototype reflects real data shapes)
