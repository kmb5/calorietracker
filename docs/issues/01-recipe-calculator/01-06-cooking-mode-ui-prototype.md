# 01-06 · Cooking Mode UI Prototype — Hero Calculator Screen

**Type:** HITL
**Blocked by:** 01-05

---

## What to build

Produce a plain HTML clickable prototype of the Cooking Mode screen. This is the **hero screen** of the entire application — the primary daily-use surface. It must be optimised for one-handed mobile use while actively cooking. Invest significant design effort here; this prototype gate exists precisely to ensure the design is excellent before implementation begins.

Screens / states to cover:
1. **Cooking Mode — loaded** — full-screen view with:
   - Recipe name at the top
   - Scrollable ingredient list: each row shows ingredient name, a large editable amount input (`inputmode="decimal"`), and the calculated kcal for that ingredient's current amount
   - "Extra calories" field (for oil spray, seasoning, etc.)
   - Prominent "Total Cooked Weight" field (shown with a visual callout — this is the key input)
   - Live **Nutrition per 100g** panel: kcal, protein, fat, carbs, fiber, sodium — updates as inputs change
   - Total batch kcal and total cooked weight displayed large as a sanity-check banner
2. **"How much am I eating?" section** — portion weight input at the bottom of Cooking Mode; live portion summary (kcal, protein, fat, carbs); "Log this portion" button; "Save cook result" secondary action
3. **Cooking Mode — zero cooked weight warning** — state where the total cooked weight is 0 or empty, showing a clear warning and disabling the per-100g panel
4. **Ad-hoc mode** — same screen but recipe name shows "Ad-hoc meal", ingredient list starts empty with an "Add ingredient" button
5. **"Log this portion" disabled state** — when portion weight is 0

Constraints:
- **375px viewport is the primary design target** — every tap target, every input, must work one-handed
- Inputs must be visually large — not standard text-input size
- The per-100g panel must remain visible without scrolling (sticky or always-visible position)
- Minimal chrome — this screen should feel like a focused tool, not a dashboard

Deliverable: HTML file(s) committed to `docs/prototypes/cooking-mode/`.

## Acceptance criteria

- [ ] All 5 states above are represented and clickable/demonstrable
- [ ] Ingredient amount inputs are visually large and clearly designed for numeric entry
- [ ] Total Cooked Weight field is visually prominent (not buried in a list)
- [ ] Per-100g nutrition panel is always visible (sticky or above-the-fold)
- [ ] "Log this portion" button is clearly the primary CTA at the bottom
- [ ] Zero cooked weight warning state is shown
- [ ] Ad-hoc mode (empty ingredient list + add button) is shown
- [ ] Prototype renders correctly at 375px with no horizontal overflow
- [ ] Prototype reviewed and **approved by owner** before 01-07 begins

## Blocked by

- 01-05 (Cooking Mode backend — so the prototype reflects the real NutritionResult shape and calculation inputs)
