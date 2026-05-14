# PRD 02 — Meal Logging & Daily Macro Tracking

## Problem Statement

Knowing the nutrition of a recipe is only half the picture. A user also needs to record what they actually ate across a day, track it against personal macro targets, and have confidence their daily total is accurate. Currently the prototypes have no persistence for "what I ate" — every session is lost. Users need a daily food diary with structured meal types, a running macro summary, and the ability to log both recipe portions and one-off ingredients without friction.

## Solution

A daily meal log where users can log meals under four fixed types (Breakfast, Lunch, Dinner, Snack). Each log entry can be a weighed portion of a saved recipe, or a direct ingredient with an amount. The daily dashboard shows a live macro summary (kcal, protein, fat, carbs, fiber) compared to user-configured targets, with visual progress indicators. Users can set per-macro daily targets in their profile settings.

## User Stories

### Daily Macro Targets (Profile Settings)
1. As a user, I want to set a daily calorie target in my profile, so that the app tracks my progress toward it throughout the day.
2. As a user, I want to set daily targets for protein, fat, carbohydrates, and fiber (in grams), so that I can track all macros I care about.
3. As a user, I want to optionally set a daily sodium target (in mg), so that I can monitor my sodium intake if needed.
4. As a user, I want macro targets to be optional — I can set just kcal if I only care about calories, so that the app is not prescriptive about which macros I track.
5. As a user, I want my macro targets to persist across sessions, so that I don't have to re-enter them every time.
6. As a user, I want to edit my targets at any time, so that I can adjust them as my goals change.

### Daily Log — Overview
7. As a user, I want to see today's meal log as the default home screen when I open the app, so that I can immediately see what I've eaten and what remains.
8. As a user, I want to see a macro summary at the top of the daily log showing total kcal, protein, fat, carbs consumed today vs my targets, so that I can assess my day at a glance.
9. As a user, I want the macro summary to use visual progress indicators (e.g. progress bars or rings) for each tracked macro, so that I can read my status without parsing numbers.
10. As a user, I want the macro summary to clearly indicate when I have exceeded a target (e.g. colour change on the progress bar), so that I notice overages immediately.
11. As a user, I want the daily log to group entries by meal type (Breakfast / Lunch / Dinner / Snack), each as a collapsible section, so that the log is easy to scan.
12. As a user, I want each meal type section to show the total kcal for that meal in the section header, so that I can see at a glance which meal was the biggest.
13. As a user, I want empty meal type sections to be collapsed or visually de-emphasised, so that the screen isn't cluttered with empty sections early in the day.
14. As a user, I want to see the total kcal and key macros for each individual log entry in the list, so that I can identify which item is contributing most.

### Logging a Meal — Recipe Portion
15. As a user, I want to log a portion of a saved recipe by selecting the recipe and entering the portion weight in grams, so that I can record a batch-cooked meal quickly.
16. As a user, I want the app to ask me for the total cooked weight if it differs from the saved last-cooked weight, so that the per-100g calculation is accurate for this specific batch.
17. As a user, I want the log entry to compute and store the absolute nutrition values for my portion (not just the per-100g rate), so that the daily total is accurate regardless of portion size.
18. As a user, I want to select which meal type (Breakfast / Lunch / Dinner / Snack) the entry belongs to when logging, so that the daily log is properly organised.
19. As a user, I want the meal type to default to a sensible suggestion based on the time of day (e.g. Breakfast before noon, Lunch 12–3pm, Dinner 6pm+), so that I don't have to change it manually most of the time.
20. As a user, I want the "Log this portion" button in Cooking Mode (PRD 01) to pre-fill the meal log form with the calculated nutrition, so that the recipe-to-log flow is seamless.

### Logging a Meal — Ad-hoc Ingredients
21. As a user, I want to log an individual ingredient directly (without a recipe) by searching the ingredient database and entering an amount, so that I can quickly log simple things like a piece of fruit, a handful of nuts, or a glass of milk.
22. As a user, I want to add multiple ingredients to a single log entry (a free-form "meal"), so that I can represent a meal composed of several individual items without creating a recipe.
23. As a user, I want ad-hoc ingredient logging to use the same autocomplete ingredient search as the recipe builder, so that the experience is consistent.
24. As a user, I want the portion amount input for ad-hoc ingredients to default to the ingredient's standard portion size, so that I just need to confirm or adjust rather than type from scratch.

### Log Entry Management
25. As a user, I want to edit a log entry after adding it (change the portion weight, change the meal type), so that I can correct mistakes made in a hurry.
26. As a user, I want to delete a log entry, with an undo option, so that accidental entries don't permanently affect my daily totals.
27. As a user, I want to see the time a log entry was created, so that I have a chronological record of my eating.

### Log History Navigation
28. As a user, I want to navigate to a previous day's log using prev/next date controls, so that I can review or correct past entries.
29. As a user, I want the date navigation to default to today, and have a "Today" shortcut button when I've navigated away, so that I can return to the current day with one tap.

## Implementation Decisions

### Data Model

**MacroTarget** (user's daily goals)
```
id, user_id (FK → User, unique),
kcal_target (float, nullable),
protein_g_target (float, nullable),
fat_g_target (float, nullable),
carbohydrates_g_target (float, nullable),
fiber_g_target (float, nullable),
sodium_mg_target (float, nullable),
updated_at
```
One row per user, upserted on save.

**MealLog** (one log entry = one item or batch of items eaten at a meal)
```
id, user_id (FK), logged_date (date),
meal_type (enum: breakfast | lunch | dinner | snack),
name (str, nullable),         -- auto-set from recipe name or ingredient name
notes (str, nullable),
created_at
```

**MealLogEntry** (individual ingredient rows within a log)
```
id, meal_log_id (FK),
ingredient_id (FK, nullable),    -- null if recipe-based
recipe_id (FK, nullable),        -- null if ingredient-based
amount_g (float),                -- weight consumed
-- Snapshot nutrition at time of logging (immutable after creation):
kcal (float),
protein_g (float),
fat_g (float),
carbohydrates_g (float),
fiber_g (float),
sodium_mg (float)       -- milligrams (consistent with ingredient DB and target field)
```

**Key design decision**: nutrition values are **snapshotted at log time** and stored as absolute values (not as a reference to per-100g data). Snapshots are frozen against external ingredient changes — editing an ingredient's nutrition values in the database never retroactively alters existing log entries. However, a user may explicitly edit their own entry's `amount_g`, which proportionally recalculates the snapshot (`new_value = old_value × (new_amount / old_amount)`). Only external ingredient edits are blocked from affecting history; user-initiated amount corrections are expected and supported.

A `MealLog` can have one or more `MealLogEntry` rows. A simple ad-hoc single-item log creates a `MealLog` with one `MealLogEntry`. A recipe portion creates a `MealLog` with as many `MealLogEntry` rows as the recipe has ingredients (or a single rolled-up entry — see notes).

### Nutrition Snapshot Strategy
Two approaches for recipe portion logging:
- **Option 1 (preferred)**: Store one `MealLogEntry` per recipe ingredient, each with its proportional nutrition snapshot. Preserves ingredient-level detail for future reference.
- **Option 2**: Store a single rolled-up `MealLogEntry` for the whole recipe portion (total kcal/macros for the eaten grams). Simpler but loses ingredient detail.

**Decision: Option 1** — the ingredient-level snapshot is more honest and enables richer history. The daily total aggregation query simply sums all `MealLogEntry` rows for the day.

### API Endpoints

```
GET    /logs?date=YYYY-MM-DD          — fetch all MealLogs + entries for a day
POST   /logs                          — create a new MealLog with entries;
                                        `logged_date` is a YYYY-MM-DD string supplied
                                        by the client (the user's local calendar date);
                                        the server never derives this from UTC now()
PATCH  /logs/{id}                     — update meal_type or notes
DELETE /logs/{id}                     — delete a MealLog and its entries

POST   /logs/{id}/entries             — add an entry to an existing log
PATCH  /logs/{id}/entries/{entry_id}  — update an entry's amount (recalculates nutrition snapshot)
DELETE /logs/{id}/entries/{entry_id}  — remove one entry

GET    /logs/summary?date=YYYY-MM-DD  — daily macro totals (aggregated from entries)
GET    /users/me/targets              — get current user's macro targets
PUT    /users/me/targets              — upsert macro targets
```

### Nutrition Snapshot Trust Model
`POST /logs` accepts client-provided nutrition values and stores them as-is. The server does **not** recompute or validate the nutrition math. This is a personal tracker — the user is the only one who benefits or suffers from inaccurate values. The integrity guarantee comes from the Cooking Mode flow, which goes through `POST /recipes/{id}/cook` (server-computed) before `POST /logs` is called. For the add-to-log sheet recipe tab, the client runs the same `calculateNutrition` TypeScript function and the server trusts the result.


```python
# Computed server-side, also available as a pure frontend utility:
def daily_summary(entries: list[MealLogEntry]) -> MacroSummary:
    return MacroSummary(
        kcal=sum(e.kcal for e in entries),
        protein_g=sum(e.protein_g for e in entries),
        fat_g=sum(e.fat_g for e in entries),
        carbohydrates_g=sum(e.carbohydrates_g for e in entries),
        fiber_g=sum(e.fiber_g for e in entries),
        sodium_mg=sum(e.sodium_mg for e in entries),
    )
```

### Meal Type Time-of-Day Defaults
```typescript
// Frontend utility — suggests meal type based on current hour
function suggestMealType(hour: number): MealType {
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'snack'
  return 'dinner'
}
```

### Frontend Architecture
- Home screen = today's daily log (not a landing/marketing page)
- Macro summary panel is a sticky component at the top of the daily log view, always visible while scrolling
- Progress bars animate smoothly as entries are added (CSS transitions)
- "Add to log" flow: bottom sheet / modal on mobile with two tabs: "Recipe" (recipe picker → portion weight) and "Ingredient" (ingredient search → amount)
- Log entries within each meal type are rendered as compact cards showing name, amount, and kcal
- Swipe-to-delete on log entry cards (mobile)
- All UI/component work to follow the **frontend-design skill** for visual consistency with the rest of the app

## Testing Decisions

### What makes a good test here
Test the daily summary aggregation, the nutrition snapshot logic, and API access control. Do not test UI rendering details.

### Backend (pytest)
- **Daily summary**: correctly sums all macros across multiple entries; returns zeros for a day with no entries; does not include another user's entries
- **Log creation**: recipe portion correctly snapshots nutrition values; ad-hoc ingredient correctly calculates and snapshots nutrition
- **Snapshot immutability**: changing an ingredient's kcal value does not change a previously created log entry
- **Access control**: user can only read/modify their own log entries
- **Macro targets**: upsert creates if not exists, updates if exists; null targets are preserved

### Frontend (Jest + React Testing Library)
- Daily macro summary: correctly aggregates entries from multiple meal types; progress bars reach 100% at target, overflow state renders correctly
- Meal type suggestion: correct type returned for boundary hours (11am, 3pm, 6pm)

## Out of Scope

- Calendar history view and trends (PRD 04)
- Sharing or exporting log entries
- Barcode scanning to log packaged food
- Meal planning (planning ahead what to eat)
- Water / hydration tracking
- Micronutrients beyond the core 6 (kcal, protein, fat, carbs, fiber, sodium)
- "Copy yesterday's log" functionality (v2)
- Copying a log entry to a different day or meal slot (v2) — the add-to-log flow already covers re-logging the same meal with minimal friction

## Further Notes

- The `logged_date` field on `MealLog` is a `date` (not `datetime`) — this avoids timezone confusion. All log entries for a day belong to the user's calendar day, regardless of when they were created.
- The macro summary panel is the most performance-sensitive UI component — it should derive entirely from client-side state after the initial day's data is fetched, never making additional network requests as items are added.
- Consider an optimistic UI update strategy for log entry creation: add the entry to local state immediately, then confirm with the server, rolling back on failure. This makes the app feel instant on mobile with variable connectivity.
