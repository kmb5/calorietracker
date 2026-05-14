# 00-13 · Admin UI Prototype — Dashboard, Promotions, System Ingredients, User Management

**Type:** HITL
**Blocked by:** 00-12

---

## What to build

Produce a plain HTML clickable prototype of the admin dashboard. This is an internal tool for the owner/admin — usability on desktop is the priority, though it should not break at mobile widths.

Screens / states to cover:
1. **Admin nav** — sidebar or tab navigation between: Promotions, System Ingredients, Users
2. **Promotions queue** — table/list of pending promotion requests showing ingredient name, submitting user, submission date; row actions: Approve, Reject (reject opens an inline note input)
3. **Promotions — empty state** — "No pending promotions"
4. **System ingredients list** — searchable table of all system ingredients; columns: name, unit, kcal; row actions: Edit, Delete; "Add ingredient" button
5. **System ingredient add/edit form** — same 9-field form as the custom ingredient form (00-10), but with `is_system=true` implied
6. **Bulk import** — file upload area accepting a JSON file; "Import" button; result summary ("12 added, 3 updated, 0 errors")
7. **Users list** — table of all users: username, email, role, active status; row actions: Deactivate/Activate, Promote to Admin

Constraints:
- Prototype renders correctly at 1280px (desktop primary) and should not break at 375px
- All actions must be clickable (no dead buttons)

Deliverable: HTML file(s) committed to `docs/prototypes/admin/`.

## Acceptance criteria

- [ ] All 7 screens/states above are represented and navigable
- [ ] Approve and Reject actions on a promotion row are clickable (reject shows a note input)
- [ ] Add ingredient and Edit ingredient forms are shown
- [ ] Bulk import file area and import button are present
- [ ] Users table with Deactivate and Promote actions is shown
- [ ] Prototype renders without broken layout at 1280px
- [ ] Prototype reviewed and **approved by owner** before 00-14 begins

## Blocked by

- 00-12 (admin backend — so the prototype reflects real endpoint capabilities)
