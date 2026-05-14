# 03-03 · Pantry List UI Implementation — Sorted List & Expiry Status Colour Coding

**Type:** HITL
**Blocked by:** 03-02

---

## What to build

Implement the pantry list screen in React, following the approved prototype from 03-02. This slice focuses on the list view and the `expiryStatus` utility — the add/edit form is a separate slice (03-04).

This slice covers:
- **Pantry screen** (`/pantry`) — fetches from `GET /pantry` on mount
- **Item cards** — name, quantity + unit, expiry date (or "No expiry")
- **Expiry status colour coding** using the `expiryStatus` utility:
  ```typescript
  function expiryStatus(expiryDate: Date | null): 'expired' | 'warning' | 'ok' | 'none' {
    if (!expiryDate) return 'none'
    const daysUntilExpiry = differenceInDays(expiryDate, startOfToday())
    if (daysUntilExpiry < 0) return 'expired'
    if (daysUntilExpiry <= 3) return 'warning'
    return 'ok'
  }
  ```
  Expired items: red styling. Warning (≤3 days): amber. OK: normal. None: muted/de-emphasised.
- **Sort order**: already applied server-side; the client renders in the order returned
- **Header summary**: total item count + count of items with `warning` or `expired` status (computed client-side)
- **Search/filter bar**: client-side filter on item name as the user types
- **Swipe-to-delete**: calls `DELETE /pantry/{id}`; undo toast (5s)
- **Empty state**: "Your pantry is empty" with a CTA to add an item (links to add form, 03-04)
- **"+" FAB**: styled and present; wired to the add form in 03-04

The `expiryStatus` utility must have its own unit tests:
- Returns `expired` for yesterday
- Returns `warning` for today and 3 days from now
- Returns `ok` for 4 days from now
- Returns `none` for null

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Pantry list loads from `GET /pantry` in the correct sort order
- [ ] Expired items render with red styling
- [ ] Items expiring within 3 days (including today) render with amber/warning styling
- [ ] Items with no expiry date are visually de-emphasised
- [ ] Header shows correct total item count and expiring-soon count
- [ ] Search bar filters visible cards in real time
- [ ] Swipe-to-delete removes the card; undo toast appears
- [ ] Empty state renders when the pantry is empty
- [ ] `expiryStatus` utility unit tests all pass
- [ ] Screen renders correctly at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 03-02 (approved pantry UI prototype)
