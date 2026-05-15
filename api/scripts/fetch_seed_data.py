#!/usr/bin/env python3
"""
One-time script to build scripts/seed_data.json from the USDA FoodData Central
SR Legacy bulk export (no API key required).

Data source: U.S. Department of Agriculture, Agricultural Research Service.
             FoodData Central, 2018. https://fdc.nal.usda.gov/  (public domain)

Usage:
    python scripts/fetch_seed_data.py

The script downloads the SR Legacy JSON (~13 MB compressed), filters it to
cooking-relevant categories with complete macro data, and writes seed_data.json.
That file is committed to the repo; seed_ingredients.py reads it at seed time
with no network access required.

Re-running is safe — it overwrites seed_data.json in place.
"""

import json
import sys
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

OUT_FILE = Path(__file__).resolve().parent / "seed_data.json"
SR_LEGACY_URL = (
    "https://fdc.nal.usda.gov/fdc-datasets/"
    "FoodData_Central_sr_legacy_food_json_2018-04.zip"
)

# USDA nutrient IDs (amounts are per 100 g in SR Legacy)
NUTRIENT_IDS: dict[int, str] = {
    1008: "kcal",
    1003: "protein",
    1004: "fat",
    1005: "carbohydrates",
    1079: "fiber",
    1093: "sodium",  # arrives as mg → converted to g below
}

# SR Legacy food categories to include — covers the issue's target categories:
# produce, proteins, grains, dairy, condiments, legumes, nuts/seeds, oils/fats
INCLUDED_CATEGORIES = {
    "Vegetables and Vegetable Products",
    "Fruits and Fruit Juices",
    "Beef Products",
    "Pork Products",
    "Poultry Products",
    "Lamb, Veal, and Game Products",
    "Finfish and Shellfish Products",
    "Sausages and Luncheon Meats",
    "Dairy and Egg Products",
    "Legumes and Legume Products",
    "Nut and Seed Products",
    "Fats and Oils",
    "Cereal Grains and Pasta",
    "Baked Products",
    "Soups, Sauces, and Gravies",
    "Spices and Herbs",
}

# Description substrings that indicate manufactured/branded items to skip
# (we want whole foods and simple preparations, not brand-name products)
SKIP_TERMS = [
    "pillsbury",
    "mcdonald",
    "burger king",
    "wendy",
    "subway",
    "campbell",
    "heinz",
    "kraft",
    "stouffer",
    "lean cuisine",
    "weight watchers",
    "slim fast",
    "ensure",
    "boost",
    "infant formula",
    "baby food",
]

TARGET_MIN = 500
TARGET_MAX = 1000


def download_sr_legacy() -> dict:
    print("Downloading SR Legacy bulk export from USDA FDC …")
    print(f"  URL: {SR_LEGACY_URL}")
    req = urllib.request.Request(
        SR_LEGACY_URL,
        headers={"User-Agent": "CalorieTrackerV3-SeedFetch/1.0"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        data = BytesIO()
        downloaded = 0
        chunk_size = 65536
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            data.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded / total * 100
                print(
                    f"\r  {downloaded / 1e6:.1f} / {total / 1e6:.1f} MB  ({pct:.0f}%)",
                    end="",
                    flush=True,
                )
    print()

    data.seek(0)
    with zipfile.ZipFile(data) as zf:
        name = zf.namelist()[0]
        print(f"  Extracting {name} …")
        with zf.open(name) as f:
            return json.load(f)


def extract_nutrients(food: dict) -> dict | None:
    """Return nutrient values per 100 g, or None if any required field is missing/invalid."""
    nm: dict[int, float] = {
        n["nutrient"]["id"]: n.get("amount") for n in food.get("foodNutrients", [])
    }
    result: dict[str, float] = {}
    for nid, key in NUTRIENT_IDS.items():
        val = nm.get(nid)
        if val is None or val < 0:
            return None
        result[key] = float(val)

    if result["kcal"] == 0:
        return None

    if result["kcal"] == 0:
        return None

    # sodium in SR Legacy is in mg → convert to g
    result["sodium"] = round(result["sodium"] / 1000, 6)
    return result


def infer_unit(description: str, category: str) -> str:
    desc = description.lower()
    cat = category.lower()
    if "fats and oils" in cat or any(w in desc for w in ("oil,", "oils,", " oil ")):
        return "ml"
    if any(w in desc for w in ("milk,", "cream,", "juice,", "beverage", "drink,")):
        return "ml"
    return "g"


def normalise(name: str) -> str:
    return name.lower().strip()


def filter_foods(raw_data: dict) -> list[dict]:
    foods = raw_data.get("SRLegacyFoods", [])
    print(f"  Total SR Legacy foods: {len(foods)}")

    seen: dict[tuple[str, str], dict] = {}
    skipped_category = 0
    skipped_macros = 0
    skipped_branded = 0

    for food in foods:
        category = food.get("foodCategory", {}).get("description", "")

        if category not in INCLUDED_CATEGORIES:
            skipped_category += 1
            continue

        description: str = food.get("description", "").strip()
        if not description:
            continue

        desc_lower = description.lower()
        if any(term in desc_lower for term in SKIP_TERMS):
            skipped_branded += 1
            continue

        nutrients = extract_nutrients(food)
        if nutrients is None:
            skipped_macros += 1
            continue

        unit = infer_unit(description, category)
        key = (normalise(description), unit)

        if key not in seen:
            seen[key] = {
                "name": description,
                "unit": unit,
                "portion_size": 100.0,
                **nutrients,
            }

    result = list(seen.values())
    print(
        f"  Skipped — wrong category: {skipped_category}, incomplete macros: {skipped_macros}, branded: {skipped_branded}"
    )
    print(f"  Kept: {len(result)} foods")
    return result


def main() -> None:
    raw = download_sr_legacy()
    print("Filtering …")
    ingredients = filter_foods(raw)

    if len(ingredients) < TARGET_MIN:
        print(
            f"\nWARNING: only {len(ingredients)} ingredients — below target min {TARGET_MIN}.",
            file=sys.stderr,
        )

    # Cap at TARGET_MAX to keep seed_data.json a reasonable size
    if len(ingredients) > TARGET_MAX:
        print(f"Capping at {TARGET_MAX} (from {len(ingredients)}) …")
        ingredients = ingredients[:TARGET_MAX]

    OUT_FILE.write_text(json.dumps(ingredients, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(ingredients)} ingredients to {OUT_FILE}")
    print("Commit seed_data.json — seed_ingredients.py reads it at seed time.")


if __name__ == "__main__":
    main()
