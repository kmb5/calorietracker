# 01-07 · Cooking Mode UI Implementation

**Type:** HITL
**Blocked by:** 01-06, 01-03

---

## What to build

Implement the Cooking Mode screen in React, following the approved prototype from 01-06. This is the most important screen in the application — performance and mobile ergonomics are the top priorities.

Implementation details:
- Cooking Mode is a **full-screen route** (`/recipes/{id}/cook` and `/cook` for ad-hoc) — it replaces the recipe list in the viewport on mobile
- State is managed with `useReducer` — the cooking session is ephemeral (lives only in component state) until explicitly saved or logged
- Ingredient amount inputs: `<input type="number" inputMode="decimal">` with large touch targets
- Per-100g nutrition **recalculates synchronously on every keystroke** using the TypeScript `calculateNutrition` utility from 01-05 — no debounce, no network call
- Total Cooked Weight defaults to the sum of ingredient amounts; the field is editable and overrides the default
- "Extra calories" field adds a flat kcal value to the batch total before the per-100g calculation
- "Save cook result" calls `POST /recipes/{id}/cook` to persist `last_cooked_at` + `last_cooked_weight_g`
- "Log this portion" button is present but disabled until 01-08 wires it to `POST /logs` — render it in a disabled/placeholder state
- **Ad-hoc mode** (`/cook`): starts with an empty ingredient list; "Add ingredient" uses the shared combobox (00-08); no "Save cook result" in ad-hoc mode (a "Save as Recipe" secondary action is acceptable but not required in this slice)

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Cooking Mode loads recipe ingredients pre-filled from `GET /recipes/{id}`
- [ ] Changing an ingredient amount instantly updates that ingredient's per-kcal display AND the per-100g panel (no network request)
- [ ] Changing the Total Cooked Weight instantly updates the per-100g panel
- [ ] Extra calories field adds to total kcal before per-100g division
- [ ] Total Cooked Weight defaults to the sum of ingredient amounts
- [ ] Zero cooked weight shows a warning and suppresses the per-100g panel
- [ ] "Save cook result" calls `POST /recipes/{id}/cook` and shows a success toast; `last_cooked_weight_g` is visible in the recipe detail after navigating back
- [ ] "Log this portion" button is visible but disabled (placeholder for 01-08)
- [ ] Ad-hoc mode starts with an empty ingredient list; ingredients can be added via the combobox
- [ ] All inputs are correctly sized for one-handed mobile use at 375px
- [ ] Per-100g panel is always visible without scrolling on a standard mobile screen
- [ ] PR reviewed and approved by owner

## Blocked by

- 01-06 (approved Cooking Mode UI prototype)
- 01-03 (recipe list + detail — Cooking Mode is launched from the recipe detail "Start Cooking" button)
