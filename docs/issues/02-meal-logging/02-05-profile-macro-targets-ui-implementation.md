# 02-05 · Profile & Macro Targets UI Implementation

**Type:** HITL
**Blocked by:** 02-04

---

## What to build

Implement the profile / settings screen in React, following the approved prototype from 02-04. Users can view their account info and set or update their daily macro targets.

This slice covers:
- **Profile screen** accessible from the main navigation (avatar/icon in nav bar or a dedicated Settings tab)
- Displays the current user's username and email (read-only, from the auth context)
- Daily target inputs: kcal, protein (g), fat (g), carbohydrates (g), fiber (g), sodium (mg)
- Fields pre-filled from `GET /users/me/targets` on load
- All fields are optional — empty fields are valid and submit as null
- Save button calls `PUT /users/me/targets`; shows a success toast on completion
- Logout button calls `POST /auth/logout` and clears auth state

The frontend-design skill must be invoked for the visual implementation.

## Acceptance criteria

- [ ] Profile screen is reachable from the main navigation when logged in
- [ ] Username and email are displayed read-only (from auth context)
- [ ] All 6 macro target fields are pre-filled from `GET /users/me/targets` on load (empty if not set)
- [ ] Saving with all fields empty is valid and stores nulls
- [ ] Saving with partial fields is valid; only set fields are non-null in the response
- [ ] Success toast appears after a successful `PUT /users/me/targets`
- [ ] Logout button calls `POST /auth/logout`, clears local state, and redirects to login
- [ ] Screen renders correctly at 375px
- [ ] PR reviewed and approved by owner

## Blocked by

- 02-04 (approved profile & macro targets UI prototype)
