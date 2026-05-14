# Issues Index

45 issues across 5 PRDs. Build order follows the dependency chain below.

**Types:** AFK = agent-executable without human review · HITL = requires human review/approval before or after

---

## PRD 00 — Foundation (14 issues)

| Issue | Title | Type | Blocked by |
|-------|-------|------|------------|
| [00-01](./00-foundation/00-01-project-scaffold.md) | Project scaffold — Docker Compose, FastAPI, React, Alembic, pre-commit | AFK | — |
| [00-02](./00-foundation/00-02-auth-backend.md) | Auth backend — register, login, refresh, logout, rate limiting, JWT | AFK | 00-01 |
| [00-03](./00-foundation/00-03-auth-screens-prototype.md) | Auth screens prototype | HITL | 00-02 |
| [00-04](./00-foundation/00-04-auth-screens-implementation.md) | Auth screens implementation | HITL | 00-03 |
| [00-05](./00-foundation/00-05-ingredient-db-seed.md) | Ingredient DB seed — schema, migration, OOF import | AFK | 00-01 |
| [00-06](./00-foundation/00-06-ingredient-search-api.md) | Ingredient search API — search + detail endpoints | AFK | 00-02, 00-05 |
| [00-07](./00-foundation/00-07-ingredient-search-ui-prototype.md) | Ingredient search UI prototype | HITL | 00-06 |
| [00-08](./00-foundation/00-08-ingredient-search-ui-implementation.md) | Ingredient search UI implementation | HITL | 00-07 |
| [00-09](./00-foundation/00-09-user-custom-ingredients-backend.md) | User custom ingredients backend — CRUD + promotion request | AFK | 00-06 |
| [00-10](./00-foundation/00-10-user-custom-ingredient-ui-prototype.md) | User custom ingredient UI prototype | HITL | 00-08, 00-09 |
| [00-11](./00-foundation/00-11-user-custom-ingredient-ui-implementation.md) | User custom ingredient UI implementation | HITL | 00-10 |
| [00-12](./00-foundation/00-12-admin-backend.md) | Admin backend — promotions, system ingredient CRUD, bulk import, user management | AFK | 00-09 |
| [00-13](./00-foundation/00-13-admin-ui-prototype.md) | Admin UI prototype | HITL | 00-12 |
| [00-14](./00-foundation/00-14-admin-ui-implementation.md) | Admin UI implementation | HITL | 00-13, 00-08 |

---

## PRD 01 — Recipe Calculator (8 issues)

| Issue | Title | Type | Blocked by |
|-------|-------|------|------------|
| [01-01](./01-recipe-calculator/01-01-recipe-crud-backend.md) | Recipe CRUD backend — schema, API, tests | AFK | 00-06 |
| [01-02](./01-recipe-calculator/01-02-recipe-management-ui-prototype.md) | Recipe management UI prototype — list, detail, create/edit | HITL | 01-01 |
| [01-03](./01-recipe-calculator/01-03-recipe-list-detail-ui-implementation.md) | Recipe list + detail UI implementation | HITL | 01-02 |
| [01-04](./01-recipe-calculator/01-04-create-edit-recipe-ui-implementation.md) | Create/edit recipe UI implementation | HITL | 01-02, 00-08 |
| [01-05](./01-recipe-calculator/01-05-cooking-mode-backend.md) | Cooking Mode backend — nutrition calculation module, /calculate + /cook | AFK | 01-01 |
| [01-06](./01-recipe-calculator/01-06-cooking-mode-ui-prototype.md) | Cooking Mode UI prototype | HITL | 01-05 |
| [01-07](./01-recipe-calculator/01-07-cooking-mode-ui-implementation.md) | Cooking Mode UI implementation | HITL | 01-06, 01-03 |
| [01-08](./01-recipe-calculator/01-08-log-this-portion-bridge.md) | "Log this portion" bridge — Cooking Mode → meal log | HITL | 01-07, 02-02 |

---

## PRD 02 — Meal Logging (10 issues)

| Issue | Title | Type | Blocked by |
|-------|-------|------|------------|
| [02-01](./02-meal-logging/02-01-macro-targets-backend.md) | Macro targets backend — schema, GET/PUT /users/me/targets | AFK | 00-02 |
| [02-02](./02-meal-logging/02-02-meal-log-backend.md) | Meal log backend — schema, CRUD, nutrition snapshot logic | AFK | 00-05, 01-01 |
| [02-03](./02-meal-logging/02-03-log-entry-management-backend.md) | Log entry management backend — edit + delete endpoints | AFK | 02-02 |
| [02-04](./02-meal-logging/02-04-profile-macro-targets-ui-prototype.md) | Profile + macro targets UI prototype | HITL | 02-01, 00-04 |
| [02-05](./02-meal-logging/02-05-profile-macro-targets-ui-implementation.md) | Profile + macro targets UI implementation | HITL | 02-04 |
| [02-06](./02-meal-logging/02-06-daily-log-home-ui-prototype.md) | Daily log home UI prototype — macro panel, meal sections, date nav | HITL | 02-02, 02-01 |
| [02-07](./02-meal-logging/02-07-daily-log-home-ui-implementation.md) | Daily log home UI implementation | HITL | 02-06 |
| [02-08](./02-meal-logging/02-08-add-to-log-flow-ui-prototype.md) | Add-to-log flow UI prototype — recipe tab + ingredient tab | HITL | 02-06 |
| [02-09](./02-meal-logging/02-09-add-to-log-flow-ui-implementation.md) | Add-to-log flow UI implementation | HITL | 02-08, 02-07, 00-08 |
| [02-10](./02-meal-logging/02-10-log-entry-management-ui.md) | Log entry management UI — edit, delete, undo | HITL | 02-03, 02-07 |

---

## PRD 03 — Pantry (7 issues)

| Issue | Title | Type | Blocked by |
|-------|-------|------|------------|
| [03-01](./03-pantry/03-01-pantry-core-backend.md) | Pantry core backend — schema, CRUD, sort, expiring endpoint | AFK | 00-02 |
| [03-02](./03-pantry/03-02-pantry-ui-prototype.md) | Pantry UI prototype — list, expiry colouring, add/edit form | HITL | 03-01 |
| [03-03](./03-pantry/03-03-pantry-list-ui-implementation.md) | Pantry list UI implementation | HITL | 03-02 |
| [03-04](./03-pantry/03-04-pantry-add-edit-form-ui-implementation.md) | Pantry add/edit form UI implementation | HITL | 03-02 |
| [03-05](./03-pantry/03-05-pantry-enhancements-backend.md) | Pantry enhancements backend — storage location filter | AFK | 03-01 |
| [03-06](./03-pantry/03-06-pantry-enhancements-ui-prototype.md) | Pantry enhancements UI prototype — filter tabs, nav badge, quick-qty | HITL | 03-05, 03-02 |
| [03-07](./03-pantry/03-07-pantry-enhancements-ui-implementation.md) | Pantry enhancements UI implementation | HITL | 03-06, 03-03 |

---

## PRD 04 — History (6 issues)

| Issue | Title | Type | Blocked by |
|-------|-------|------|------------|
| [04-01](./04-history/04-01-calendar-aggregation-backend.md) | Calendar aggregation backend — /logs/calendar | AFK | 02-02 |
| [04-02](./04-history/04-02-streak-backend.md) | Streak backend — /logs/streak | AFK | 02-02 |
| [04-03](./04-history/04-03-history-calendar-ui-prototype.md) | History calendar UI prototype | HITL | 04-01 |
| [04-04](./04-history/04-04-history-calendar-ui-implementation.md) | History calendar UI implementation — CSS grid | HITL | 04-03 |
| [04-05](./04-history/04-05-weekly-strip-streak-ui-prototype.md) | Weekly strip + streak UI prototype | HITL | 04-02, 04-03 |
| [04-06](./04-history/04-06-weekly-strip-streak-ui-implementation.md) | Weekly strip + streak UI implementation — SVG bar chart | HITL | 04-05, 04-04 |

---

## Summary

| PRD | AFK | HITL | Total |
|-----|-----|------|-------|
| 00 Foundation | 5 | 9 | 14 |
| 01 Recipe Calculator | 2 | 6 | 8 |
| 02 Meal Logging | 3 | 7 | 10 |
| 03 Pantry | 2 | 5 | 7 |
| 04 History | 2 | 4 | 6 |
| **Total** | **14** | **31** | **45** |
