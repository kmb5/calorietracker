# 04-05 · Weekly Strip & Streak UI Prototype — 7-Day Bar Chart & Streak Display

**Type:** HITL
**Blocked by:** 04-02, 04-03

---

## What to build

Produce a plain HTML clickable prototype for the weekly summary strip and logging streak display — the section below the monthly calendar in the History view. This prototype extends the history prototype from 04-03.

Screens / states to cover:
1. **Weekly strip — populated** — 7-day bar chart showing daily kcal for the last 7 days; bars are labelled with the day abbreviation (Mon, Tue, etc.) and a small kcal value; a horizontal reference line marks the user's daily kcal target; bars at or below target are one colour, bars above target are a different colour (e.g. amber)
2. **Weekly strip — average summary row** — below the chart: "7-day avg" values for kcal, protein, fat, and carbs displayed as compact labels
3. **Weekly strip — missing days** — some bars at zero height or absent for days with no log entries (grey stub or empty slot)
4. **Weekly strip — no target set** — chart without the reference line; all bars the same colour
5. **Streak display** — prominently displayed above or alongside the weekly strip: "Current streak: 7 days 🔥" and "Best: 21 days"; streak = 0 shows "Start your streak today!"
6. **Streak = 0 state** — zero-streak encouragement message

Constraints:
- 375px mobile-first
- The bar chart must be readable at 375px — 7 bars with legible labels
- The streak display should feel motivational, not clinical

Deliverable: Updated or new HTML file(s) committed to `docs/prototypes/history/weekly-strip/`.

## Acceptance criteria

- [ ] 7-day bar chart with labelled bars is shown
- [ ] Horizontal target reference line is visible
- [ ] Above-target bars are visually distinct
- [ ] 7-day average row shows kcal, protein, fat, carbs
- [ ] Missing-day (zero-height) bars are handled gracefully
- [ ] No-target state shows the chart without a reference line
- [ ] Current streak and longest streak are displayed
- [ ] Zero-streak state shows an encouragement message
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 04-06 begins

## Blocked by

- 04-02 (streak backend — so the prototype reflects the real streak response shape)
- 04-03 (history calendar prototype — weekly strip lives on the same screen; must be visually consistent)
