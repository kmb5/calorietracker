# 02-07 · Daily Log Home UI Implementation — Macro Panel, Meal Sections, Date Navigation

**Type:** HITL
**Blocked by:** 02-06

---

## What to build

Implement the daily log home screen in React, following the approved prototype from 02-06. This is the app's default route (`/`) — the first thing users see on every session.

This slice covers:
- **Default route** (`/`) shows today's log; fetches from `GET /logs?date=today` and `GET /logs/summary?date=today` and `GET /users/me/targets` on mount
- **Macro summary panel** — sticky at the top; **4 progress bars**: kcal, protein, fat, carbohydrates; fiber shown as a compact numeric label below the bars (e.g. "Fiber: 18 / 30g") — five bars is too cramped on a 375px sticky panel; CSS transition animations as entries are added; overflow state (>110% of target) changes bar colour; if no targets set, show numbers-only without progress bars
- **Meal type sections** — Breakfast / Lunch / Dinner / Snack; each section is collapsible; section header shows per-section kcal total; empty sections are visually de-emphasised (collapsed by default)
- **Log entry cards** — name, amount (g), kcal; tapping opens the edit sheet (implemented in 02-10)
- **Date navigation** — prev/next arrows update the date param; "Today" button appears when not on today; fetches new data on date change
- **Macro summary derives entirely from client-side state** after the initial fetch — adding/removing entries updates the panel without additional network requests
- **"+" FAB** — present and styled, but its action (opening the add-to-log sheet) is wired in 02-09

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Default route `/` shows today's meal log on load
- [ ] Macro summary panel is sticky and visible while scrolling
- [ ] Progress bars animate smoothly (CSS transition) when entries load
- [ ] Overflow state (>110%) renders a visually distinct bar colour
- [ ] No-targets state renders numbers without progress bars
- [ ] Meal sections group entries correctly by `meal_type`
- [ ] Empty sections are collapsed or visually de-emphasised on load
- [ ] Section headers show per-section kcal total
- [ ] Date navigation prev/next changes the date and fetches the correct day's data
- [ ] "Today" shortcut button appears when viewing a past/future date and navigates back to today
- [ ] Macro summary updates in real time when entries are added or removed (no extra network request)
- [ ] "+" FAB is present and styled (wired in 02-09)
- [ ] Screen renders correctly at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 02-06 (approved daily log home UI prototype)
