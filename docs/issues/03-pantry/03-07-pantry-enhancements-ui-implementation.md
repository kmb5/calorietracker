# 03-07 · Pantry Enhancements UI Implementation — Location Filter, Nav Badge, Quick-Qty Controls

**Type:** HITL
**Blocked by:** 03-06, 03-03

---

## What to build

Implement the pantry enhancements in React, following the approved prototype from 03-06. These enhancements layer on top of the existing pantry list screen (03-03).

This slice covers:
- **Storage location filter tabs** — "All / Fridge / Freezer / Pantry" segmented control at the top of the pantry list; tapping a tab calls `GET /pantry?location=<value>`; "All" calls `GET /pantry` (no filter); active tab is visually highlighted; empty filtered state shown when no items in the selected location
- **Nav badge** — the Pantry navigation tab shows a badge with the count from `GET /pantry/expiring?days=3`; badge is hidden when count is 0; fetched once on mount and refreshed when items are added/deleted
- **Quick-quantity controls** — swipe-right (or long-press) on a pantry item card reveals inline +/- buttons; tapping + calls `PATCH /pantry/{id}` with `quantity + 1`; tapping - calls `PATCH /pantry/{id}` with `quantity - 1` (minimum 0); the quantity on the card updates immediately (optimistic)

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Location filter tabs appear at the top of the pantry list
- [ ] Tapping a tab fetches filtered results from the API and updates the list
- [ ] Selecting "All" shows all items (no filter param)
- [ ] Empty filtered state renders when a location tab has no items
- [ ] Nav badge shows the correct expiring-soon count
- [ ] Nav badge is hidden when count is 0
- [ ] Swipe-right (or long-press) on a card reveals the +/- controls
- [ ] Tapping + updates the quantity immediately (optimistic) and calls `PATCH /pantry/{id}`
- [ ] Tapping - decrements quantity; quantity does not go below 0
- [ ] Quantity update is rolled back with an error toast on network failure
- [ ] All interactions work correctly at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 03-06 (approved pantry enhancements UI prototype)
- 03-03 (pantry list implementation — enhancements build on the existing list screen)
