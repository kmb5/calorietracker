# 04-04 · History Calendar UI Implementation — CSS Grid, Day-Status Colour Coding, Month Navigation

**Type:** HITL
**Blocked by:** 04-03

---

## What to build

Implement the History calendar view in React, following the approved prototype from 04-03. The calendar is built from scratch as a CSS grid — no third-party date picker or calendar library, keeping the bundle size down and enabling full visual customisation.

This slice covers:
- **History tab** in the main navigation — routes to `/history`
- **Monthly calendar grid** — 7-column CSS grid, one cell per day; weekday headers (Mon–Sun)
- **Day-status colour coding** using the `dayStatus` utility:
  ```typescript
  type DayStatus = 'logged-on-target' | 'logged-over' | 'logged-under' | 'no-log'

  function dayStatus(summary: DaySummary | null, target: number | null): DayStatus {
    if (!summary || summary.entry_count === 0) return 'no-log'
    if (!target) return 'logged-on-target' // no target set — show as logged
    const ratio = summary.total_kcal / target
    if (ratio >= 0.9 && ratio <= 1.1) return 'logged-on-target'
    if (ratio > 1.1) return 'logged-over'
    return 'logged-under'
  }
  ```
  `dayStatus` must have unit tests for all four status cases including the null-target case.
- **Data loading**: `GET /logs/calendar?year=&month=` on mount and on month change; `GET /users/me/targets` for the kcal target (can reuse cached value from profile context)
- **Month navigation**: prev/next arrows; current month + year in the header; defaults to today's month
- **Today highlight**: today's cell is visually distinguished
- **Future days**: greyed out, no dot, no kcal label, pointer-events disabled
- **Tapping a logged day**: navigates to `/` with the tapped date set as the active date in the daily log view (reuses the date navigation from 02-07)

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] History tab is present in the main navigation and routes to `/history`
- [ ] Calendar renders as a 7-column grid with correct weekday alignment for any month
- [ ] All four day statuses render with distinct, correct colours
- [ ] `dayStatus` utility unit tests all pass
- [ ] Month navigation updates the grid and fetches new data
- [ ] Today's cell is visually highlighted
- [ ] Future day cells are greyed out and non-interactive
- [ ] Tapping a past logged day navigates to that day's log view
- [ ] Calendar renders correctly at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 04-03 (approved history calendar UI prototype)
