# 02-04 · Profile & Macro Targets UI Prototype

**Type:** HITL
**Blocked by:** 02-01, 00-04

---

## What to build

Produce a plain HTML clickable prototype for the profile / settings screen where users set their daily macro targets. This is a supporting screen — functional but not visually complex.

Screens / states to cover:
1. **Profile / settings screen** — accessible from the main nav; shows the user's username and email (read-only); daily target inputs for kcal, protein (g), fat (g), carbohydrates (g), fiber (g), sodium (mg); all fields optional; Save button
2. **Saved state** — a success confirmation after saving (toast or inline message)
3. **Pre-filled state** — same form with example values already filled in (showing how a returning user sees it)
4. **Partially filled state** — only kcal target set; other fields empty — confirming that partial targets are valid

Constraints:
- 375px mobile-first viewport
- Numeric inputs for macro values
- Labels must make the units clear (g vs mg)

Deliverable: HTML file(s) committed to `docs/prototypes/profile/`.

## Acceptance criteria

- [ ] Settings screen shows all 6 target fields with correct unit labels
- [ ] All fields are shown as optional (no required-field indicators)
- [ ] Pre-filled state demonstrates an existing user's saved targets
- [ ] Partially-filled state demonstrates that incomplete targets are valid
- [ ] Save button triggers a success confirmation state
- [ ] Prototype renders correctly at 375px
- [ ] Prototype reviewed and **approved by owner** before 02-05 begins

## Blocked by

- 02-01 (macro targets backend — so the prototype reflects the real field set)
- 00-04 (auth UI — profile screen is only accessible when authenticated)
