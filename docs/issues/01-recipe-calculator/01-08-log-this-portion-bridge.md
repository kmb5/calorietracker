# 01-08 · "Log This Portion" Bridge — Cooking Mode → Meal Log

**Type:** HITL
**Blocked by:** 01-07, 02-02

---

## What to build

Wire the "Log this portion" button in Cooking Mode to `POST /logs`, completing the end-to-end flow from cooking a recipe to recording what you ate. This is a thin slice that connects the two halves of the application.

The flow:
1. User enters a portion weight in the "How much am I eating?" section of Cooking Mode
2. User taps "Log this portion"
3. The app calls `POST /recipes/{id}/cook` to get the server-validated `NutritionResult` and persist the cook session (if not already saved)
4. The app calls `POST /logs` with the portion's nutrition snapshot (proportional share of the per-100g values × portion weight), the suggested meal type, and today's date
5. On success: navigates to the daily log view for today (`/`) with a success toast ("Logged to Breakfast")

The meal type is pre-populated using the `suggestMealType(hour)` utility (defined in PRD 02):
```typescript
function suggestMealType(hour: number): MealType {
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'snack'
  return 'dinner'
}
```

The button remains **disabled** when the portion weight input is 0 or empty.

The frontend-design skill must be invoked for any UI changes to the Cooking Mode screen.

## Acceptance criteria

- [ ] "Log this portion" button is enabled only when portion weight > 0
- [ ] Tapping the button calls `POST /recipes/{id}/cook` (if not already saved this session) then `POST /logs`
- [ ] The log entry's nutrition values are correctly proportioned to the entered portion weight (not the full batch)
- [ ] Meal type is pre-selected based on the current time of day using `suggestMealType`
- [ ] On success, the user is navigated to the daily log view and a success toast confirms the logged meal type
- [ ] On network error, an error toast is shown and the user remains on the Cooking Mode screen
- [ ] `POST /logs` is not called if the portion weight is 0
- [ ] The flow works for both saved-recipe Cooking Mode and ad-hoc Cooking Mode
- [ ] PR reviewed and approved by owner

## Blocked by

- 01-07 (Cooking Mode UI — the button lives on this screen)
- 02-02 (meal log backend — `POST /logs` endpoint must exist)
