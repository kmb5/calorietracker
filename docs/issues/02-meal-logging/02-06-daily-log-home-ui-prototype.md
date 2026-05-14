# 02-06 · Daily Log Home UI Prototype — Macro Summary Panel, Meal Sections, Date Navigation

**Type:** HITL
**Blocked by:** 02-02, 02-01

---

## What to build

Produce a plain HTML clickable prototype of the daily log home screen — the default screen users see when they open the app. This is the second most important screen after Cooking Mode. It must convey the day's nutrition status at a glance, be scannable in seconds, and stay usable on a phone while eating.

Screens / states to cover:
1. **Daily log — active day** — today's date in the header; sticky macro summary panel at the top showing **4 progress bars** (kcal, protein, fat, carbs) with target values, plus a compact fiber numeric label (e.g. "Fiber: 18 / 30g") below the bars; four meal type sections (Breakfast / Lunch / Dinner / Snack), each collapsible; section headers show per-section kcal total; log entry cards within each section (ingredient name, amount, kcal); "+" add button (links to add-to-log flow, static in prototype)
2. **Macro summary — target exceeded** — one or more progress bars at 110%+; show the overflow colour state (amber/red)
3. **Macro summary — no targets set** — macro values shown without progress bars (just numbers)
4. **Empty meal section** — a collapsed or visually muted empty section (e.g. Dinner with no entries)
5. **Date navigation** — prev/next arrow buttons in the header; a "Today" pill button that appears when viewing a past date; a past day's date shown in the header
6. **Past day — read-only hint** — subtle indicator that you're viewing a past day (optional: different header colour or label)

Constraints:
- 375px mobile-first
- Macro summary panel must be sticky (always visible while scrolling through meal sections)
- Progress bars must be immediately readable — label, value, and bar in one compact row

Deliverable: HTML file(s) committed to `docs/prototypes/daily-log/`.

## Acceptance criteria

- [ ] All 6 states above are represented and navigable
- [ ] Macro summary panel contains progress bars for kcal, protein, fat, and carbs, plus a fiber numeric label
- [ ] Overflow state (>110% of target) shows visually distinct colour on the relevant bar
- [ ] No-targets state shows numeric values without progress bars
- [ ] Empty meal sections are visually de-emphasised (not four identical empty boxes)
- [ ] Date navigation prev/next is clickable and changes the header date
- [ ] "Today" button appears when viewing a past date
- [ ] Macro summary panel stays fixed while scrolling the meal sections (demonstrate with example showing entries below the fold)
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 02-07 begins

## Blocked by

- 02-02 (meal log backend — so the prototype reflects real data shapes)
- 02-01 (macro targets backend — so the progress bar panel reflects real target fields)
