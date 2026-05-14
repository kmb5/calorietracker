# 03-02 · Pantry UI Prototype — List, Expiry Colouring, Add/Edit Form

**Type:** HITL
**Blocked by:** 03-01

---

## What to build

Produce a plain HTML clickable prototype of the pantry feature: the sorted pantry list with expiry status colour coding, and the add/edit item bottom sheet. This prototype must be approved before 03-03 and 03-04 begin.

Screens / states to cover:
1. **Pantry list — populated** — scrollable list of pantry item cards; each card shows: name, quantity + unit, expiry date (or "No expiry"); header shows total item count and "3 expiring soon" badge; search bar at the top
2. **Expiry colour states** — demonstrate three cards in the list: one expired (red), one expiring within 3 days (amber/warning), one with a future date (normal), one with no expiry date (muted/at the bottom)
3. **Pantry list — empty state** — "Your pantry is empty" with an "Add your first item" CTA
4. **Add item bottom sheet** — name input (free-text) OR ingredient search toggle; quantity input + unit input; expiry date picker (mobile date input or styled date picker); storage location selector (fridge / freezer / pantry / other); notes field; Save button; after save, sheet resets for quick-add next item
5. **Edit item sheet** — same form pre-filled with existing values; includes a "Remove item" danger button
6. **Swipe-to-delete hint** — a card in a partially-swiped/deleting state

Constraints:
- 375px mobile-first viewport
- The expiry colour coding must be instantly distinguishable (not just subtle tints)
- The add form should feel fast to fill — minimum required fields for a quick entry

Deliverable: HTML file(s) committed to `docs/prototypes/pantry/`.

## Acceptance criteria

- [ ] All 6 screens/states are represented and navigable
- [ ] Three expiry colour states (expired, warning, ok) are visually distinct
- [ ] No-expiry items appear below dated items in the list
- [ ] Add form shows all fields including the free-text / ingredient-search toggle
- [ ] Edit form is pre-filled and includes a remove button
- [ ] Swipe-to-delete hint state is shown
- [ ] Empty state CTA is clickable
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 03-03 and 03-04 begin

## Blocked by

- 03-01 (pantry core backend — so the prototype reflects the real data model)
