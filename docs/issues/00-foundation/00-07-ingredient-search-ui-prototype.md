# 00-07 · Ingredient Search UI Prototype — Combobox & Detail View

**Type:** HITL
**Blocked by:** 00-06

---

## What to build

Produce a plain HTML clickable prototype of the ingredient search experience. This is the shared UI primitive that will be embedded in the recipe builder, the meal log add flow, and the pantry add form — getting it right here pays off everywhere.

Screens / states to cover:
1. **Search combobox — idle** — empty input with placeholder text
2. **Search combobox — typing** — dropdown showing result rows (name, unit, kcal at a glance), system vs custom badge, keyboard-navigable
3. **Search combobox — selected** — selected ingredient shown in the input, clear button
4. **Ingredient detail panel / sheet** — full nutrition breakdown: kcal, protein, fat, carbs, fiber, sodium per portion; unit and portion size shown; system vs custom badge
5. **No results state** — empty results message with a "Create custom ingredient" call-to-action link (links to 00-10's form, static in prototype)

Constraints:
- 375px viewport (mobile-first)
- Dropdown must feel tap-friendly (adequate row height)
- Keyboard navigation between results must be visible in the prototype (highlight state)

Deliverable: HTML file(s) committed to `docs/prototypes/ingredient-search/`.

## Acceptance criteria

- [ ] All 5 states listed above are represented and clickable
- [ ] Result rows show name, unit, and kcal
- [ ] System vs custom badge is visually distinct
- [ ] Detail panel shows all 6 nutrition fields
- [ ] No-results state includes a "Create custom ingredient" link
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 00-08 begins

## Blocked by

- 00-06 (ingredient search API — so the prototype reflects real data shapes and edge cases)
