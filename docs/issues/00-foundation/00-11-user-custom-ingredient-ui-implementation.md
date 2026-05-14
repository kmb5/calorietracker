# 00-11 · User Custom Ingredient UI Implementation

**Type:** HITL
**Blocked by:** 00-10

---

## What to build

Implement the custom ingredient create/edit form and promotion submit flow in React, following the approved prototype from 00-10. The ingredient search combobox (00-08) shows a "Create custom ingredient" CTA in its empty-results state — this slice makes that link functional.

This slice covers:
- **Create form** — all 9 fields, calls `POST /ingredients` on submit; new ingredient immediately appears in search results
- **Edit form** — pre-fills from `GET /ingredients/{id}`; calls `PATCH /ingredients/{id}` on save
- **Delete** — confirmation step before calling `DELETE /ingredients/{id}`; removes ingredient from local search results
- **Custom badge** — user-owned ingredients show a "custom" badge in the search combobox (extend the component from 00-08)
- **Ingredient detail — custom view** — detail sheet/popover for user-owned ingredients includes edit and "Submit for review" buttons
- **Submit for review** — calls `POST /ingredients/{id}/promote`; shows a confirmation toast; button becomes disabled/label changes to "Pending review" afterwards

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] "Create custom ingredient" link in the search combobox's empty-results state navigates to the create form
- [ ] Create form validates all required fields before submission
- [ ] Newly created ingredient appears in the combobox search results immediately (no page reload)
- [ ] Edit form opens pre-filled for a custom ingredient
- [ ] Saving the edit form updates the ingredient and reflects changes in search results
- [ ] Delete button shows a confirmation step; confirmed deletion removes the ingredient
- [ ] Custom ingredients show a "custom" badge in combobox results
- [ ] "Submit for review" calls `POST /ingredients/{id}/promote` and shows a success toast
- [ ] "Submit for review" button is disabled / shows "Pending review" after submission
- [ ] All interactions work at 375px viewport
- [ ] PR reviewed and approved by owner

## Blocked by

- 00-10 (approved custom ingredient UI prototype)
