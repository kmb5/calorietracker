# 04-06 · Weekly Strip & Streak UI Implementation — SVG Bar Chart & Streak Counters

**Type:** HITL
**Blocked by:** 04-05, 04-04

---

## What to build

Implement the weekly summary strip and streak display in React, following the approved prototype from 04-05. These components live on the `/history` screen, below the monthly calendar from 04-04.

This slice covers:
- **Weekly strip** — a 7-day rolling kcal bar chart built in **inline SVG** (no charting library)
  - Data: fetches `GET /logs/weekly-summary` (no `end_date`, defaults to today) on mount — a dedicated call separate from the monthly calendar fetch, necessary because the 7-day window can span two calendar months
  - Bars: one per day; height proportional to `total_kcal`; bar colour changes when above the kcal target
  - Reference line: horizontal SVG `<line>` at the target kcal height (hidden when no target is set)
  - Labels: day abbreviation below each bar; kcal value above each bar (or as tooltip on tap)
  - Zero-entry days: bars rendered at zero height or as a grey stub
- **7-day average row** — below the chart: computed client-side from the 7-day window data
  - Average daily kcal, protein, fat, carbohydrates displayed as compact `label: value` pairs
- **Streak display** — fetches from `GET /logs/streak` once on mount
  - Current streak: prominently displayed with a 🔥 icon when > 0
  - Longest streak: shown as a secondary stat
  - Zero streak: shows an encouragement message ("Start your streak today!")

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] 7-day SVG bar chart renders with correct bar heights relative to the maximum value
- [ ] Bars above the kcal target render in the distinct above-target colour
- [ ] Reference line is shown when a kcal target is set; hidden when no target is set
- [ ] Zero-entry days render as zero-height bars or grey stubs (not errors)
- [ ] Day labels and kcal values are readable at 375px
- [ ] 7-day averages are correct (computed client-side from the day summaries)
- [ ] `GET /logs/streak` is called once on mount; current and longest streaks are displayed
- [ ] Zero-streak state displays the encouragement message
- [ ] Weekly strip and streak display render correctly at 375px alongside the calendar grid from 04-04
- [ ] PR reviewed and approved by owner

## Blocked by

- 04-05 (approved weekly strip & streak UI prototype)
- 04-04 (history calendar implementation — weekly strip lives on the same `/history` screen)
