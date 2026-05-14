# PRD 03 — Pantry

## Problem Statement

A home cook keeps a fridge and pantry with perishable ingredients. Without a simple inventory tracker, they forget what they have, buy duplicates, or let food expire and go to waste. They need a minimal, low-friction way to log what's in stock — with enough detail to know when things expire — so they can make informed decisions about what to cook without opening the fridge.

## Solution

A simple pantry inventory feature where users can log items they have in stock, with a quantity, unit, and optional expiry date. The pantry view sorts items by expiry (soonest first) so the user always sees what needs to be used up. Items can be added, updated, and removed with minimal interaction. This is an intentionally simple, focused feature — no recipe integration, no shopping lists, no automatic deduction.

## User Stories

### Viewing the Pantry
1. As a user, I want to see all my current pantry items in a single scrollable list, so that I have a quick overview of my stock.
2. As a user, I want pantry items to be sorted by expiry date ascending (soonest to expire first), so that I can immediately see what needs to be used before it goes bad.
3. As a user, I want items without an expiry date to appear at the bottom of the list, so that dated items are always prioritised.
4. As a user, I want items expiring within 3 days to be visually highlighted (e.g. warning colour), so that I notice them at a glance.
5. As a user, I want items that have already expired to be visually distinguished (e.g. error/red colour), so that I know what to discard.
6. As a user, I want to see the item name, quantity, unit, and expiry date on each pantry card, so that I have all relevant info without tapping into a detail view.
7. As a user, I want to search/filter my pantry by item name, so that I can quickly check if I have a specific ingredient.
8. As a user, I want to see the total number of items in my pantry and a count of items expiring soon, so that I can gauge the state of my pantry at a glance.

### Adding Pantry Items
9. As a user, I want to add a pantry item by searching the ingredient database and selecting an ingredient, so that pantry items are linked to known nutrition data.
10. As a user, I want to add a pantry item as a free-text entry (not linked to the ingredient database), so that I can log items quickly without needing a matching ingredient record.
11. As a user, I want to specify a quantity and unit when adding an item (e.g. "400 g", "2 pieces", "1 can"), so that the pantry reflects my actual stock.
12. As a user, I want to set an expiry date when adding an item, so that the sorting and warnings work correctly.
13. As a user, I want the expiry date field to use a mobile-friendly date picker, so that entering a date is fast on a phone.
14. As a user, I want to add a short note to a pantry item (e.g. "opened", "freezer", "bottom shelf"), so that I can add context that helps me find or use the item.
15. As a user, I want to add multiple pantry items in a quick-entry session (add one, then immediately be ready to add the next), so that logging a full shop doesn't require repeatedly reopening the add form.

### Editing & Removing Items
16. As a user, I want to tap a pantry item to edit its quantity, unit, expiry date, or note, so that I can update it when I use some of the stock.
17. As a user, I want to mark a pantry item as "used up" / remove it with one tap (or swipe), so that I can keep the pantry list clean without navigating into a detail view.
18. As a user, I want a confirmation step before deleting a pantry item, or an undo option after deletion, so that accidental removals can be reversed.
19. As a user, I want to quickly update the quantity of an item (e.g. tap a +/- control) without opening a full edit form, so that small quantity changes are fast.

### Pantry Organisation
20. As a user, I want to optionally assign a storage location to a pantry item (fridge, freezer, pantry/cupboard), so that I know where to look for it.
21. As a user, I want to filter the pantry view by storage location, so that I can see only fridge or only freezer items at a time.

## Implementation Decisions

### Data Model

**PantryItem**
```
id, user_id (FK → User),
name (str),                         -- free-text display name
ingredient_id (FK nullable),        -- optional link to ingredient DB
quantity (float),
unit (str),                         -- free-text or from ingredient unit
expiry_date (date, nullable),
storage_location (enum: fridge | freezer | pantry | other, default: pantry),
notes (str, nullable),
created_at, updated_at
```

The `ingredient_id` link is optional — pantry items can be free-text so the user is never blocked by a missing ingredient record. When linked, the ingredient name is used as a fallback display name, but `name` is always stored independently so renaming an ingredient doesn't break the pantry.

### Sort Logic
The default pantry sort order (applied server-side and client-side):
1. Items with `expiry_date IS NOT NULL`, sorted by `expiry_date ASC` (soonest first)
2. Items with `expiry_date IS NULL`, sorted by `created_at DESC`

### Expiry Status Logic
```typescript
// Frontend utility:
function expiryStatus(expiryDate: Date | null): 'expired' | 'warning' | 'ok' | 'none' {
  if (!expiryDate) return 'none'
  const daysUntilExpiry = differenceInDays(expiryDate, startOfToday())
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 3) return 'warning'
  return 'ok'
}
```
Warning threshold (3 days) should be a user-configurable setting in v2; hard-coded for v1.

### API Endpoints

```
GET    /pantry                        — list all user's pantry items (sorted by expiry)
POST   /pantry                        — create pantry item
PATCH  /pantry/{id}                   — update item (quantity, expiry, notes, location)
DELETE /pantry/{id}                   — delete item
GET    /pantry/expiring?days=3        — items expiring within N days (for a badge/summary)
```

### Frontend Architecture
- Pantry is a dedicated tab/section in the main navigation
- Default view: sorted list with expiry-status colour coding
- Storage location filter as a segmented control at the top (All / Fridge / Freezer / Pantry)
- "Add item" is a bottom sheet on mobile with: ingredient search OR free-text name, quantity input, unit input, date picker for expiry, location selector, notes
- Quick-quantity update: long-press or swipe-right on a card reveals +/- controls (no modal)
- Swipe-left on a card to delete
- Badge on the Pantry nav item showing count of items expiring within 3 days
- All UI/component work to follow the **frontend-design skill** for visual consistency

## Testing Decisions

### What makes a good test here
Test sort logic and expiry status calculations. Test API access control. Do not test UI rendering.

### Backend (pytest)
- **Sort order**: items with expiry dates appear before items without; items with earlier expiry dates appear first; items past expiry date appear at the top (most negative days first)
- **Access control**: user can only read/modify their own pantry items; another user's pantry items return 404
- **CRUD**: create, update quantity, update expiry, delete
- **Expiring endpoint**: returns only items within the requested day window

### Frontend (Jest)
- `expiryStatus` utility: returns correct status for: already expired, expiring today, expiring in 3 days, expiring in 4 days, no expiry date

## Out of Scope

- Integration with recipes (checking if you have ingredients for a recipe)
- Automatic pantry deduction when logging a meal
- Shopping list generation
- Barcode scanning for adding pantry items
- Expiry notifications / push alerts (v2)
- Sharing pantry with household members (v2)
- Nutritional summary of pantry contents

## Further Notes

- The pantry is deliberately kept simple for v1. The temptation to integrate it with recipes and meal logging is real, but adds significant complexity around partial quantities, unit conversions, and staleness. Nail the simple inventory first.
- The 3-day warning threshold is intentionally conservative for a home cook — most perishable proteins and dairy need to be used within 2–3 days of purchase or opening.
- Free-text pantry items (not linked to the ingredient DB) are important for usability — users should never feel like they need to first add an ingredient to the DB just to log that they have it in the fridge.
- The storage location filter is a small quality-of-life feature that costs little to implement but significantly helps users who have a well-organised fridge vs freezer vs dry goods distinction.
