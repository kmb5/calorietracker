# 03-06 · Pantry Enhancements UI Prototype — Location Filter, Nav Badge, Quick-Qty Controls

**Type:** HITL
**Blocked by:** 03-05, 03-02

---

## What to build

Produce an updated HTML clickable prototype showing the pantry enhancements: the storage location filter tabs, the navigation badge indicating expiring items, and the quick-quantity update controls. This prototype updates and extends the one from 03-02.

Screens / states to cover:
1. **Storage location filter** — segmented control or tab strip at the top of the pantry list: All / Fridge / Freezer / Pantry; tapping a tab filters the list to only show items of that location
2. **Filter — Fridge tab selected** — list shows only fridge items; the "Freezer" and "Pantry" tabs are unselected; item count in the header reflects the filtered set
3. **Filter — empty filtered state** — "No items in Freezer" empty state when a location tab has no items
4. **Nav badge** — the Pantry tab in the main navigation shows a small numbered badge (e.g. "3") indicating items expiring within 3 days; badge is absent if count is 0
5. **Quick-quantity controls** — long-press or swipe-right on a pantry item card reveals inline +/- buttons for quantity (no modal or sheet); tapping + increments by 1; tapping - decrements by 1 (min 0); the new quantity value is immediately visible on the card

Constraints:
- 375px mobile-first
- The segmented control must not push the item list too far down — keep it compact
- Quick-qty controls should feel instant and effortless (large tap targets)

Deliverable: Updated or new HTML file(s) committed to `docs/prototypes/pantry/enhancements/`.

## Acceptance criteria

- [ ] Segmented control with All / Fridge / Freezer / Pantry tabs is shown
- [ ] Tapping a tab changes the visible list (clickable in prototype)
- [ ] Empty filtered state is shown for one of the tabs
- [ ] Nav badge on the Pantry navigation item is shown with a count
- [ ] Quick-quantity +/- controls appear on a card (via long-press or swipe-right state)
- [ ] Quantity value updates when + or - is tapped (prototype can use JS toggle)
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 03-07 begins

## Blocked by

- 03-05 (pantry enhancements backend — filter API must exist for prototype to be accurate)
- 03-02 (original pantry prototype — this slice builds on and extends it)
