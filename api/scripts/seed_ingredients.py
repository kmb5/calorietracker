#!/usr/bin/env python3
"""
Seed the ingredients table from the bundled USDA FoodData Central dataset.

Usage (from repo root):
    docker compose run --rm api python scripts/seed_ingredients.py

The seed data (seed_data.json) was built once by fetch_seed_data.py from the
USDA SR Legacy bulk export (public domain) and is committed to the repository.
No network access is required at seed time.

The script is fully idempotent — re-running never duplicates entries.
Rows are matched by normalised (lowercased + stripped) name + unit.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── Ensure the api/app package is importable when run as a script ─────────────
# Works both locally (python api/scripts/seed_ingredients.py) and
# inside the Docker container (python scripts/seed_ingredients.py from /app)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.models.ingredient import Ingredient, UnitType  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

SCRIPTS_DIR = Path(__file__).resolve().parent
DEFAULT_INGREDIENTS_JSON = SCRIPTS_DIR / "default_ingredients.json"
SEED_DATA_JSON = SCRIPTS_DIR / "seed_data.json"

TARGET_MIN = 500
TARGET_MAX = 1000


def normalise(name: str) -> str:
    return name.lower().strip()


def load_json(path: Path) -> list[dict]:
    with path.open() as f:
        return json.load(f)


def merge(defaults: list[dict], usda: list[dict]) -> list[dict]:
    """
    Merge USDA data with hand-curated defaults.
    Defaults act as an override layer: any USDA entry whose normalised
    name + unit matches a default is replaced by the default's values.
    """
    default_index = {(normalise(d["name"]), d["unit"]): d for d in defaults}

    merged: dict[tuple[str, str], dict] = {}
    for item in usda:
        key = (normalise(item["name"]), item["unit"])
        merged[key] = item

    # Defaults win — add/overwrite on top
    for key, item in default_index.items():
        merged[key] = item

    result = list(merged.values())
    # Enforce the 500–1000 row target. Defaults are always included first
    # (they are the highest-quality entries); USDA items fill the remainder.
    if len(result) > TARGET_MAX:
        default_keys = set(default_index.keys())
        priority = [v for k, v in merged.items() if k in default_keys]
        remainder = [v for k, v in merged.items() if k not in default_keys]
        result = (priority + remainder)[:TARGET_MAX]
    log.info("Merged dataset: %d unique ingredients", len(result))
    return result


async def upsert(session: AsyncSession, ingredients: list[dict]) -> tuple[int, int]:
    """Idempotent insert/update by normalised name + unit."""
    existing_rows = (await session.execute(select(Ingredient))).scalars().all()
    existing_map: dict[tuple[str, str], Ingredient] = {
        (normalise(row.name), row.unit): row for row in existing_rows
    }
    log.info("Existing rows in DB: %d", len(existing_map))

    inserted = updated = 0

    for item in ingredients:
        key = (normalise(item["name"]), item["unit"])
        unit_val = UnitType(item["unit"])

        if key in existing_map:
            row = existing_map[key]
            row.kcal = item["kcal"]
            row.protein = item["protein"]
            row.fat = item["fat"]
            row.carbohydrates = item["carbohydrates"]
            row.fiber = item["fiber"]
            row.sodium = item["sodium"]
            row.portion_size = item["portion_size"]
            updated += 1
        else:
            new_row = Ingredient(
                name=item["name"],
                unit=unit_val,
                portion_size=item["portion_size"],
                kcal=item["kcal"],
                protein=item["protein"],
                fat=item["fat"],
                carbohydrates=item["carbohydrates"],
                fiber=item["fiber"],
                sodium=item["sodium"],
                is_system=True,
                owner_id=None,
                is_promotion_pending=False,
            )
            session.add(new_row)
            existing_map[key] = new_row
            inserted += 1

    await session.commit()
    return inserted, updated


async def main() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    defaults = load_json(DEFAULT_INGREDIENTS_JSON)
    log.info("Loaded %d curated default ingredients", len(defaults))

    usda = load_json(SEED_DATA_JSON)
    log.info("Loaded %d USDA seed ingredients", len(usda))

    ingredients = merge(defaults, usda)

    async with factory() as session:
        inserted, updated = await upsert(session, ingredients)

    async with factory() as session:
        total: int = (
            await session.execute(
                text(
                    "SELECT COUNT(*) FROM ingredients "
                    "WHERE is_system = true AND kcal > 0"
                )
            )
        ).scalar_one()

    log.info(
        "Seed complete — inserted: %d  updated: %d  total system rows: %d",
        inserted,
        updated,
        total,
    )

    if total < TARGET_MIN:
        log.error(
            "Row count %d is below the minimum target of %d.",
            total,
            TARGET_MIN,
        )
        sys.exit(1)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
