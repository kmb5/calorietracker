# 04-03 · History Calendar UI Prototype — Monthly Grid & Day-Status Colour Coding

**Type:** HITL
**Blocked by:** 04-01

---

## What to build

Produce a plain HTML clickable prototype for the History calendar view. The calendar is a read-only aggregation layer on top of meal log data — its primary purpose is showing at a glance how consistently the user has been logging and hitting their calorie target.

Screens / states to cover:
1. **Calendar — populated month** — 7-column CSS grid; each day cell contains: a coloured dot indicator, an optional small kcal label; today is highlighted; a row of weekday headers (Mon–Sun)
2. **Day status colours** — demonstrate all four statuses in the same calendar:
   - 🟢 `logged-on-target` — kcal within ±10% of target
   - 🟡 `logged-over` — kcal > 110% of target
   - ⚫ `no-log` — no entries that day (grey/muted)
   - (Optional) `logged-under` — kcal < 90% of target (different shade of green or blue)
3. **Month navigation** — prev/next month arrow buttons in the header; current month + year label
4. **Future days** — days after today are greyed out and visually non-interactive (no dot, no kcal label)
5. **Tapping a past day** — tapping a logged day navigates to that day's meal log view (static link in prototype)
6. **No-target state** — a calendar where the user has no daily kcal target set; all logged days show as a neutral "logged" dot (no green/red distinction)

Constraints:
- 375px mobile-first
- Day cells must be large enough to tap comfortably (min ~44px touch target)
- The month header and navigation must not take up more than ~15% of the screen height

Deliverable: HTML file(s) committed to `docs/prototypes/history/`.

## Acceptance criteria

- [ ] All 6 states/scenarios above are represented
- [ ] All four day status colours are visible in the same calendar
- [ ] Month navigation prev/next is clickable
- [ ] Future days are visually distinct and non-interactive
- [ ] Tapping a past day navigates to a placeholder daily log view
- [ ] No-target state shows a neutral logged/not-logged distinction
- [ ] Day cells are comfortably tappable at 375px (no tiny cells)
- [ ] Prototype reviewed and **approved by owner** before 04-04 begins

## Blocked by

- 04-01 (calendar aggregation backend — so the prototype reflects the real DaySummary shape and the `dayStatus` logic)
