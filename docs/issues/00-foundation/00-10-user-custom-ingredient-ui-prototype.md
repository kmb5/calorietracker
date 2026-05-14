# 00-10 · User Custom Ingredient UI Prototype — Create/Edit Form & Promotion

**Type:** HITL
**Blocked by:** 00-08, 00-09

---

## What to build

Produce a plain HTML clickable prototype for the custom ingredient create/edit experience and the promotion submit flow. This prototype must be approved before any React implementation work (00-11) begins.

Screens / states to cover:
1. **Create custom ingredient form** — all 9 fields: name, unit (select), portion size, kcal, protein, fat, carbohydrates, fiber, sodium; save button; cancel
2. **Edit custom ingredient form** — same form, pre-filled; delete button with confirmation
3. **Custom badge in search results** — show how a custom ingredient appears in the combobox dropdown (builds on 00-07 prototype, add a "custom" badge variant)
4. **Ingredient detail — custom ingredient** — detail view for a user-owned ingredient with an additional "Submit for review" button
5. **Promotion confirmation** — small confirmation dialog/toast after submitting for review ("Submitted — an admin will review your ingredient")

Constraints:
- 375px mobile viewport
- Form must show a validation error state (e.g. empty required field)
- Unit selector should show the four valid options: g, ml, tablespoon, piece

Deliverable: HTML file(s) committed to `docs/prototypes/custom-ingredient/`.

## Acceptance criteria

- [ ] Create form shows all 9 fields with appropriate input types (number fields for nutrition values)
- [ ] Edit form pre-fills with example data and includes a delete button
- [ ] Delete confirmation step is shown (modal or inline confirm)
- [ ] Custom badge is visible on ingredient in search results
- [ ] "Submit for review" button is present on custom ingredient detail view
- [ ] Promotion confirmation message is shown after clicking "Submit for review"
- [ ] At least one validation error state is demonstrated
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 00-11 begins

## Blocked by

- 00-08 (ingredient search UI — prototype builds on the search combobox states)
- 00-09 (user custom ingredients backend — so the prototype reflects real fields and constraints)
