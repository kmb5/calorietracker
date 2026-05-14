# 02-08 · Add-to-Log Flow UI Prototype — Recipe Tab, Ingredient Tab, Meal Type Selector

**Type:** HITL
**Blocked by:** 02-06

---

## What to build

Produce a plain HTML clickable prototype of the "add to log" bottom sheet — the modal that appears when a user taps the "+" FAB on the daily log screen. It has two tabs: adding a saved recipe portion and adding an individual ingredient directly.

Screens / states to cover:
1. **Bottom sheet — Recipe tab (default)** — recipe search/select list (showing recent recipes); selected recipe shows a portion weight input (grams); meal type selector (segmented or dropdown); "Log" button
2. **Recipe tab — recipe selected** — recipe name shown, portion weight input focused, meal type pre-selected by time of day
3. **Recipe tab — cooked weight prompt** — if the selected recipe's `last_cooked_weight_g` is stale or absent, a prompt to enter/confirm the total cooked weight for this batch before logging
4. **Ingredient tab** — ingredient search combobox (same component as 00-07); once selected, an amount input defaulting to the ingredient's standard portion size; meal type selector; "Log" button
5. **Bottom sheet — loading/submitting state** — Log button shows a spinner; sheet is disabled during submission
6. **Success state** — sheet closes; a toast confirms "Logged to Lunch" (or whichever meal type)

Constraints:
- 375px mobile-first
- Bottom sheet slides up from the bottom (standard mobile pattern)
- Meal type selector should not dominate the UI — it is a confirmation, not a primary decision
- Amount/portion weight input must be numeric and large

Deliverable: HTML file(s) committed to `docs/prototypes/add-to-log/`.

## Acceptance criteria

- [ ] Both Recipe and Ingredient tabs are represented and switchable
- [ ] Recipe tab shows a recipe selector and a portion weight input
- [ ] Cooked weight prompt state is shown for the recipe flow
- [ ] Ingredient tab shows an ingredient search combobox and an amount input
- [ ] Meal type selector is present on both tabs
- [ ] Loading/submitting state is shown
- [ ] Success toast state is shown
- [ ] Prototype renders correctly at 375px as a bottom sheet
- [ ] Prototype reviewed and **approved by owner** before 02-09 begins

## Blocked by

- 02-06 (daily log home prototype — the bottom sheet opens from the home screen; must be consistent with that design)
