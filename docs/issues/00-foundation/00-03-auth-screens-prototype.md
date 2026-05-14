# 00-03 · Auth Screens Prototype — Login & Register

**Type:** HITL
**Blocked by:** 00-02

---

## What to build

Produce a plain HTML clickable prototype covering the login and register screens. The goal is to get the layout, interaction flow, and mobile ergonomics approved by the owner **before any React work begins**. No framework, no API calls — just static HTML/CSS that demonstrates the screens and their transitions.

Screens to cover:
1. **Login** — username/email field, password field, submit button, error state (wrong credentials), link to register
2. **Register** — username, email, password fields, submit button, inline validation errors, link to login
3. **Logged-in redirect** — a simple placeholder "You are logged in" state to show the successful auth flow

Constraints:
- Prototype must be viewable at a **375px viewport** (mobile-first)
- Navigation between screens must be clickable (anchor tags or `<button onclick>`)
- Show at least one error state per form (e.g. "Invalid credentials" on login, "Email already registered" on register)
- No real HTTP requests; form submissions can just toggle a visible state

Deliverable: one or more `.html` files committed to `docs/prototypes/auth/` (or equivalent), linked from this issue.

## Acceptance criteria

- [ ] Login screen renders correctly at 375px width
- [ ] Register screen renders correctly at 375px width
- [ ] Clicking submit on the login form shows the logged-in placeholder state
- [ ] Clicking submit on the register form shows a success/redirect placeholder state
- [ ] At least one error state is demonstrated on each form
- [ ] Navigation between login ↔ register is clickable
- [ ] Prototype reviewed and **approved by owner** before 00-04 begins

## Blocked by

- 00-02 (auth backend — so the prototype reflects real endpoint shapes and error cases)
