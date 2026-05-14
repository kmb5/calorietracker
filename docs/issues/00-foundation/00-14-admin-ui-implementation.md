# 00-14 · Admin UI Implementation — Dashboard, Promotions, System Ingredients, User Management

**Type:** HITL
**Blocked by:** 00-13, 00-08

---

## What to build

Implement the admin dashboard in React, following the approved prototype from 00-13. The route is accessible only to users with `role=admin`; all others are redirected.

This slice covers:
- **Admin route guard** — `/admin/*` routes redirect non-admin users to the home screen
- **Promotions tab** — lists pending promotions from `GET /admin/ingredients/promotions`; Approve calls `POST /admin/ingredients/promotions/{id}/approve`; Reject opens an inline note input then calls `POST /admin/ingredients/promotions/{id}/reject`
- **System ingredients tab** — searchable list of system ingredients; Add form uses the same 9-field form pattern established in 00-11; Edit pre-fills; Delete shows a confirmation step (and handles the HTTP 409 "in use" error gracefully with a message)
- **Bulk import tab** — JSON file upload; calls `POST /admin/ingredients/bulk-import`; shows result summary
- **Users tab** — lists all users from `GET /admin/users`; Deactivate/Activate toggles `is_active`; Promote to Admin updates role
- **Ingredient search integration** — the system ingredient list search reuses the `GET /ingredients/search` endpoint and the shared combobox component from 00-08 where appropriate

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] `/admin` redirects to home for non-admin users
- [ ] Promotions tab loads and displays pending promotions
- [ ] Approve action succeeds and removes the row from the queue
- [ ] Reject action requires a note and succeeds; row removed from queue
- [ ] System ingredients tab is searchable and shows all system ingredients
- [ ] Add/edit ingredient form works end-to-end; new ingredients appear in the global search immediately
- [ ] Delete shows confirmation; handles the "ingredient in use" error with a user-friendly message
- [ ] Bulk import accepts a valid JSON file and shows a result summary
- [ ] Users tab lists all users; Deactivate/Activate toggles work; Promote to Admin works
- [ ] All admin views render correctly at 1280px desktop width
- [ ] PR reviewed and approved by owner

## Blocked by

- 00-13 (approved admin UI prototype)
- 00-08 (ingredient search component used in admin ingredient management)
