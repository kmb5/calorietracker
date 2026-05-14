# 04-02 · Streak Backend — /logs/streak API

**Type:** AFK
**Blocked by:** 02-02

---

## What to build

Implement the streak calculation endpoint. A "logging streak" is the number of consecutive calendar days (ending today or yesterday) on which the user created at least one meal log entry. This is a motivational read-only feature derived entirely from existing `MealLog` data.

Endpoint:
```
GET /logs/streak
```

Response:
```json
{
  "current_streak_days": 5,
  "longest_streak_days": 21
}
```

Streak definitions:
- **Current streak**: the number of consecutive days with at least one log entry, counting back from today. If today has no entries yet, count back from yesterday (so the streak is not broken just because the user hasn't logged today yet). If neither today nor yesterday has entries, `current_streak_days = 0`.
- **Longest streak**: the longest consecutive run of logged days in the user's entire history.

The calculation should be efficient — iterate over the user's distinct `logged_date` values in descending order rather than scanning all rows.

## Acceptance criteria

- [ ] `GET /logs/streak` returns `current_streak_days` and `longest_streak_days`
- [ ] A single logged day returns `current_streak_days = 1`
- [ ] Five consecutive logged days return `current_streak_days = 5`
- [ ] A gap of one unlogged day (with logs both before and after) breaks the current streak and resets it to the post-gap count
- [ ] No log entries at all returns `{ current_streak_days: 0, longest_streak_days: 0 }`
- [ ] If today has no entries but yesterday does, `current_streak_days` counts from yesterday (streak not considered broken)
- [ ] `longest_streak_days` correctly reflects the longest historical run, even if the current streak is shorter
- [ ] Response does not include data from other users
- [ ] Endpoint requires authentication (HTTP 401 for unauthenticated)
- [ ] All streak cases are covered by automated tests (single day, consecutive, broken, no entries, today-empty yesterday-logged)

## Blocked by

- 02-02 (meal log backend — streak reads the `MealLog.logged_date` column)
