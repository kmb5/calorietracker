# 02-09 · Add-to-Log Flow UI Implementation

**Type:** HITL
**Blocked by:** 02-08, 02-07, 00-08

---

## What to build

Implement the add-to-log bottom sheet in React, following the approved prototype from 02-08. Wires the "+" FAB on the daily log home screen (02-07) to a fully functional log-entry creation flow.

This slice covers:
- **Bottom sheet** triggered by the "+" FAB on the daily log; two tabs: Recipe and Ingredient
- **Recipe tab**
  - Recipe list from `GET /recipes` (most recently cooked first)
  - Selecting a recipe shows a portion weight input (grams)
  - If `last_cooked_weight_g` is null or the user wants to change it, a cooked weight field is shown
  - Meal type selector, pre-populated by `suggestMealType(hour)` from 01-08
  - "Log" calls `POST /logs` with the nutrition snapshot for the entered portion weight (computed client-side using the TypeScript `calculateNutrition` from 01-05; server trusts these values — no server-side recomputation)
- **Ingredient tab**
  - Ingredient search combobox from 00-08
  - Amount input defaults to the ingredient's `portion_size`
  - Meal type selector (same as Recipe tab)
  - "Log" calls `POST /logs` with the computed nutrition snapshot
- **Optimistic UI** — log entry added to local state immediately; daily macro summary updates at once; rolled back on network failure
- **Success** — bottom sheet closes; success toast ("Logged to Dinner")

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] "+" FAB on the daily log opens the bottom sheet
- [ ] Recipe tab lists recipes from `GET /recipes`; selecting one shows the portion weight field
- [ ] Cooked weight field appears when `last_cooked_weight_g` is null
- [ ] Meal type is pre-selected via `suggestMealType` but user-editable
- [ ] "Log" on the Recipe tab calls `POST /logs`; entry appears in the correct meal section immediately
- [ ] Ingredient tab search uses the shared combobox from 00-08
- [ ] Amount input defaults to the ingredient's `portion_size`
- [ ] "Log" on the Ingredient tab calls `POST /logs`; entry appears immediately
- [ ] Macro summary panel on the home screen updates without an additional network request
- [ ] On network failure, the optimistic entry is removed and an error toast is shown
- [ ] Bottom sheet renders correctly at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 02-08 (approved add-to-log flow UI prototype)
- 02-07 (daily log home — FAB lives on this screen; macro summary must update)
- 00-08 (ingredient search combobox — used in the Ingredient tab)
