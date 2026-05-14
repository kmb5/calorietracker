# PRD 04 — History & Calendar View

> **Priority: Backburner / v2**
> This PRD is intentionally scoped as a later feature. The recipe calculator (PRD 01), meal logging (PRD 02), and pantry (PRD 03) should all ship and be stable before this work begins. The data model defined in PRD 02 already captures everything needed for this feature — no schema changes are required.

## Problem Statement

A user who has been logging meals for several weeks has no way to review their historical data in a meaningful way. They can navigate to individual past days via the date controls in the daily log (PRD 02), but there is no at-a-glance view of how their nutrition has tracked over time. They cannot tell whether they've been consistently meeting their calorie goal, which days they missed logging entirely, or how their macros trend across the week.

## Solution

A calendar view where each day is colour-coded based on whether the user logged that day and how their calorie intake compared to their target. Tapping any day opens that day's full meal log. A weekly summary strip below the calendar shows rolling macro averages. This feature is fully powered by the existing `MealLog` data model — it is a read-only aggregation and display layer.

## User Stories

### Calendar View
1. As a user, I want to see a monthly calendar where each day shows a coloured indicator of my calorie intake relative to my target, so that I can assess my consistency at a glance.
2. As a user, I want days where I hit my calorie target (within ±10%) to show as green, days where I significantly over-ate (>110% of target) to show as amber/red, and days with no log entries to show as grey, so that the colour coding is immediately meaningful.
3. As a user, I want to tap any past day on the calendar to view that day's full meal log, so that I can review exactly what I ate.
4. As a user, I want to navigate between months with prev/next controls, so that I can look back at older history.
5. As a user, I want to see the current month by default, with today highlighted, so that the calendar is always anchored to the present.
6. As a user, I want future days to be greyed out and non-interactive, so that the calendar is not confusing.
7. As a user, I want the calendar to show a small kcal number on each logged day (or just the indicator if space is tight on mobile), so that I can see exact values without tapping.

### Weekly Summary Strip
8. As a user, I want a 7-day rolling summary strip below the calendar showing daily kcal bars for the last 7 days, so that I have a quick recent-trend view without navigating the full calendar.
9. As a user, I want the weekly strip to show my daily target as a horizontal reference line on the kcal bar chart, so that I can see how each day compared to my goal.
10. As a user, I want the weekly strip to display average daily values for kcal, protein, fat, and carbs over the 7-day window, so that I can see my recent macro averages.

### Logging Streak
11. As a user, I want to see my current consecutive-day logging streak displayed prominently, so that I have a motivational reason to log every day.
12. As a user, I want to see my longest-ever logging streak, so that I have a personal record to beat.

## Implementation Decisions

### Data Model
No new tables required. All data comes from existing `MealLog` + `MealLogEntry` tables (PRD 02) and `MacroTarget` (PRD 02).

### API Endpoints

```
GET /logs/calendar?year=YYYY&month=MM
  — returns an array of DaySummary for each day in the month:
    { date, total_kcal, total_protein_g, total_fat_g, total_carbs_g, entry_count }
  — days with no entries are omitted (client treats missing days as no-log)

GET /logs/streak
  — returns { current_streak_days, longest_streak_days }
```

The `/logs/calendar` endpoint is a single efficient query aggregating `MealLogEntry` rows grouped by `logged_date` for the requested month. It should complete in under 100ms even with years of log history (index on `user_id + logged_date`).

### Colour Coding Logic
```typescript
type DayStatus = 'logged-on-target' | 'logged-over' | 'logged-under' | 'no-log'

function dayStatus(summary: DaySummary | null, target: number | null): DayStatus {
  if (!summary || summary.entry_count === 0) return 'no-log'
  if (!target) return 'logged-on-target' // no target set — just show as logged
  const ratio = summary.total_kcal / target
  if (ratio >= 0.9 && ratio <= 1.1) return 'logged-on-target'
  if (ratio > 1.1) return 'logged-over'
  return 'logged-under'
}
```

### Frontend Architecture
- History is a dedicated tab in the main navigation
- Calendar rendered as a CSS grid (7 columns), not a third-party date picker library — keeps bundle size down and allows full visual customisation
- Each day cell: coloured dot indicator + optional kcal label (shown only if space permits, hidden on smallest breakpoint)
- Tapping a day navigates to the daily log view for that date (reuses PRD 02 daily log component, date passed as param)
- Weekly strip is a lightweight SVG bar chart — no charting library needed for this simple shape
- All UI/component work to follow the **frontend-design skill** for visual consistency

## Testing Decisions

### Backend (pytest)
- **Calendar aggregation**: correct kcal sum for a day with multiple entries across multiple meal types; days with no entries are omitted from response; does not include other users' data
- **Streak calculation**: single-day streak; consecutive days; broken streak resets to 1; no entries = 0 streak

### Frontend (Jest)
- `dayStatus` utility: all four status cases; null target treated as on-target

## Out of Scope

- Detailed macro trend charts (weekly/monthly line charts) — v3
- Exporting history to CSV or PDF
- Comparing against previous weeks/months
- Body weight / body composition tracking
- Integration with Apple Health, Google Fit, or other fitness platforms

## Further Notes

- This feature is entirely read-only from a data perspective — it does not introduce any new writes or mutations. This makes it safe to defer without any data model risk; the `MealLog` data being created by PRD 02 is already the right shape.
- The streak feature is a low-effort motivational addition. A "logging streak" is meaningful for this use case because the core habit being built is consistent daily logging, not just occasional use.
- The calendar colour coding should be generous — a day where the user logged anything at all should feel positive, even if they exceeded their target. The goal is to reinforce the logging habit first, dietary precision second.
