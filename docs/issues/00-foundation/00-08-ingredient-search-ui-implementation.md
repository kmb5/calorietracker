# 00-08 · Ingredient Search UI Implementation — Combobox & Detail View

**Type:** HITL
**Blocked by:** 00-07

---

## What to build

Implement the ingredient search combobox and detail view in React, following the approved prototype from 00-07. This component is a shared primitive — it will be imported by the recipe builder (01-04), the add-to-log flow (02-09), and the pantry add form (03-04).

Implementation details:
- Use the **shadcn/ui Combobox** as the base component, extended with async search
- Debounce the search input before calling `GET /ingredients/search`
- Result rows show: name, unit, portion size, kcal; system vs custom badge
- Selecting an ingredient can trigger an `onSelect` callback (composable for different parent contexts)
- Ingredient detail view (sheet/popover): shows all 6 nutrition fields, unit, portion size, provenance badge
- Consider `useDeferredValue` on the search query to keep the input feeling instant
- "Create custom ingredient" CTA in empty-results state (links to the custom ingredient form, available after 00-11)

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Typing in the combobox triggers `GET /ingredients/search` (debounced, not on every keystroke)
- [ ] Results render with name, unit, kcal, and system/custom badge
- [ ] Selecting a result fires the `onSelect` callback with the full ingredient object
- [ ] Keyboard navigation (arrow keys + enter) works in the dropdown
- [ ] Ingredient detail sheet/popover shows all 6 nutrition fields
- [ ] Empty results state shows a "Create custom ingredient" link
- [ ] Component renders and functions correctly at 375px
- [ ] Component is exported as a reusable module (not hard-coded to a single page)
- [ ] PR reviewed and approved by owner

## Blocked by

- 00-07 (approved ingredient search UI prototype)
