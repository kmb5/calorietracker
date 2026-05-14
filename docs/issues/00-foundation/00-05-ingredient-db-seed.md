# 00-05 · Ingredient DB Seed — Schema, Migration, Open Food Facts Import

**Type:** AFK
**Blocked by:** 00-01

---

## What to build

Create the `Ingredient` database table and populate it with a curated seed of ~500–1000 real cooking ingredients sourced from the Open Food Facts (OOF) dataset. This is a pure backend/data slice — no API endpoints yet (those come in 00-06).

Schema introduced:
```
Ingredient:
  id, name, unit (g | ml | tablespoon | piece),
  portion_size (float),        -- the "per X" baseline
  kcal (float),                -- per portion_size
  protein (float), fat (float), carbohydrates (float),
  fiber (float), sodium (float),
  is_system (bool),            -- true = seeded / admin-managed
  owner_id (FK nullable),      -- null for system; user_id for custom
  is_promotion_pending (bool),
  created_at, updated_at
```

The seed script (`scripts/seed_ingredients.py`):
- Reads a filtered OOF CSV export
- Filters to entries with **complete** macro data (all six fields present and non-zero)
- Targets common cooking categories: produce, proteins, grains, dairy, condiments, legumes
- Merges the prototype's 38-item curated JSON (`default_ingredients.json`) as a hand-verified override layer
- Is **idempotent**: upserts by normalised (lowercased, stripped) name + unit — re-running never duplicates entries
- Sets `is_system=true`, `owner_id=null` for all seeded entries

Open Food Facts dataset is CC BY-SA 4.0 — a note should be added to the app footer (tracked here for awareness, implemented later).

## Acceptance criteria

- [ ] Alembic migration for the `ingredients` table applies cleanly
- [ ] `docker compose run api python scripts/seed_ingredients.py` completes without error
- [ ] After seeding, the `ingredients` table contains between 500 and 1000 rows
- [ ] All seeded rows have `is_system=true` and `owner_id=null`
- [ ] All seeded rows have non-null, non-zero values for kcal, protein, fat, carbohydrates, fiber, and sodium
- [ ] The 38 prototype curated entries are present with their hand-verified values (spot-check 5)
- [ ] Re-running the seed script does not increase the row count (idempotent upsert verified)
- [ ] Unit enum is enforced at the DB level: only `g`, `ml`, `tablespoon`, `piece` are valid values

## Blocked by

- 00-01 (project scaffold — Alembic, Docker, PostgreSQL service)
