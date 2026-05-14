# 04-01 · Calendar Aggregation Backend — /logs/calendar API

**Type:** AFK
**Blocked by:** 02-02

---

## What to build

Implement two calendar aggregation endpoints that power the History view. Both derive entirely from the existing `MealLog` / `MealLogEntry` data — no schema changes required.

Endpoints:
```
GET /logs/calendar?year=YYYY&month=MM
GET /logs/weekly-summary?end_date=YYYY-MM-DD
```

**`/logs/calendar`** returns an array of `DaySummary` objects, one per day that has at least one log entry, for the requested month.

**`/logs/weekly-summary`** returns an array of `DaySummary` objects for the 7 calendar days ending on `end_date` (inclusive; defaults to today). Days with no entries are omitted. This endpoint exists specifically to avoid month-boundary gaps when the current week spans two calendar months.

Shared `DaySummary` shape:
```json
[
  {
    "date": "2026-01-14",
    "total_kcal": 1842.5,
    "total_protein_g": 142.0,
    "total_fat_g": 68.3,
    "total_carbs_g": 195.1,
    "entry_count": 7
  }
]
```

Days with no entries are **omitted** from the response (the client treats missing days as no-log days). This keeps the response small for months with sparse logging.

The query aggregates `MealLogEntry` rows grouped by `logged_date` for the given month. It must use an index on `(user_id, logged_date)` to stay fast even with years of history. A targeted performance test should verify the query completes in under 100ms against a dataset of 2+ years of daily logs.

## Acceptance criteria

- [ ] `GET /logs/calendar?year=2026&month=01` returns `DaySummary` array for January 2026
- [ ] Each `DaySummary` contains the correct summed `total_kcal`, `total_protein_g`, `total_fat_g`, `total_carbs_g`, and `entry_count`
- [ ] Days with entries across multiple meal types are summed correctly into one day total
- [ ] Days with no entries are omitted from the response
- [ ] `GET /logs/weekly-summary` (no `end_date`) returns 7 days ending today
- [ ] `GET /logs/weekly-summary?end_date=2026-02-03` returns DaySummary for Jan 28 – Feb 3 (spanning two months correctly)
- [ ] `GET /logs/weekly-summary` days with no entries are omitted (same convention as calendar)
- [ ] Both endpoints return only the calling user's data
- [ ] An index on `(user_id, logged_date)` exists (via migration)
- [ ] Query completes in under 100ms against a seeded dataset of 730+ days of log history (performance test or explain-plan assertion)
- [ ] Missing or invalid `year`/`month` params on `/logs/calendar` return HTTP 422
- [ ] Invalid `end_date` on `/logs/weekly-summary` returns HTTP 422
- [ ] Both endpoints require authentication (HTTP 401 for unauthenticated requests)
- [ ] All behaviours are covered by automated tests

## Blocked by

- 02-02 (meal log backend — aggregates the `MealLogEntry` table)
