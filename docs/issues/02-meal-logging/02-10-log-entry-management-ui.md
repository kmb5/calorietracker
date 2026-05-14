# 02-10 · Log Entry Management UI — Edit, Delete, Undo

**Type:** HITL
**Blocked by:** 02-03, 02-07

---

## What to build

Implement the edit and delete interactions for individual log entries on the daily log home screen, following the design established in 02-06's approved prototype. Users need to be able to correct mistakes quickly without navigating away from the daily log.

This slice covers:
- **Swipe-to-delete** on a log entry card → calls `DELETE /logs/{id}/entries/{entry_id}`; the entry is removed from the UI immediately (optimistic); an **undo toast** appears for 5 seconds — tapping undo reverses the deletion (re-adds via `POST /logs/{id}/entries`)
- **Edit entry** — tapping a log entry card opens a small edit sheet with:
  - Amount (g) field, pre-filled with the current `amount_g`
  - Meal type selector, pre-filled with the current `meal_type`
  - Save calls `PATCH /logs/{id}/entries/{entry_id}` (amount change) and/or `PATCH /logs/{id}` (meal type change)
  - Cancel dismisses without changes
- **Macro summary updates** — adding/removing/editing an entry immediately updates the sticky macro summary panel with the correct new totals (client-side recalculation from updated entry list)
- **Empty log after last entry deleted** — if a meal section becomes empty after deletion, it collapses/de-emphasises as per the prototype

The frontend-design skill must be invoked for any UI changes.

## Acceptance criteria

- [ ] Swiping left on a log entry card triggers a delete action and removes the entry from the UI immediately
- [ ] An undo toast appears for 5 seconds after deletion
- [ ] Tapping "Undo" on the toast reverses the deletion; the entry re-appears in the correct meal section
- [ ] Tapping a log entry card opens the edit sheet pre-filled with the current amount and meal type
- [ ] Saving the edit sheet calls the correct PATCH endpoint(s) and reflects changes immediately
- [ ] After editing an entry's amount, the macro summary panel shows the updated totals
- [ ] After deleting an entry, the macro summary panel shows the updated totals
- [ ] An empty meal section after deletion collapses or de-emphasises correctly
- [ ] All interactions work at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 02-03 (log entry management backend — PATCH/DELETE entry endpoints must exist)
- 02-07 (daily log home implementation — entry cards and macro panel live on this screen)
