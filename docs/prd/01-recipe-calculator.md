# PRD 01 — Recipe Calculator (Hero Feature)

## Problem Statement

When cooking a batch meal at home, a cook needs to know the nutritional value of what they've made — but the final dish is not the same as the sum of raw ingredients. Evaporation, fat rendering, and sauce reduction change the weight. The cook needs to be able to define a recipe as a reusable template (list of ingredients + quantities), then — at the moment of cooking — enter the actual total cooked weight to get accurate per-100g nutrition. They then need to portion out the dish by weight and know exactly what they're eating.

Existing prototypes solve this in a CLI (calorie-counter) and a disposable UI session (caltrack Vue prototype) but neither saves recipes, requires login, or is mobile-optimised.

## Solution

A recipe module where users create and manage named recipe templates (ingredient blueprints with no pre-computed nutrition). When cooking, the user opens a recipe, the app enters **Cooking Mode**: ingredients are listed with live-editable weight inputs, a "total cooked weight" field is shown, and nutrition per 100g is calculated in real time. The user can then input how many grams they're eating to get a portion summary, which feeds into the meal log.

This is the **primary, hero feature** of the application. It must be exceptionally fast and frictionless on mobile.

## User Stories

### Recipe Management
1. As a user, I want to create a named recipe with a description and a list of ingredients + amounts, so that I have a reusable blueprint for meals I cook regularly.
2. As a user, I want to search for and add any ingredient from the database (system or my own custom) to a recipe, so that I can build accurate ingredient lists.
3. As a user, I want to specify the amount and unit for each ingredient in my recipe, so that the template reflects how I actually cook it.
4. As a user, I want to edit an existing recipe (rename it, add/remove/change ingredient amounts), so that I can keep it accurate as my cooking evolves.
5. As a user, I want to delete a recipe I no longer use, with a confirmation step, so that I don't accidentally remove something.
6. As a user, I want to see a list of all my saved recipes, sorted by most recently used, so that my frequently-cooked meals are always at the top.
7. As a user, I want to search my recipe list by name, so that I can find a specific recipe quickly even if I have many saved.
8. As a user, I want to duplicate an existing recipe as a starting point for a variation, so that I don't have to rebuild ingredient lists from scratch.
9. As a user, I want each recipe to show a "last cooked" timestamp and the last cooked weight I entered, so that the cooked-weight field in Cooking Mode is pre-filled as a starting point next time.

### Cooking Mode — Real-time Calculator
10. As a user, I want to tap a recipe and immediately enter Cooking Mode from my recipe list, so that the transition from "choosing what to cook" to "active cooking calculator" is one tap.
11. As a user, I want to see all recipe ingredients listed with their template amounts pre-filled as editable inputs, so that I can quickly adjust for today's actual quantities (e.g. used 400g chicken instead of 350g).
12. As a user, I want ingredient amount inputs to be large, tap-friendly number fields optimised for mobile one-handed use, so that I can update quantities easily while my hands might be messy from cooking.
13. As a user, I want the calories and macros for each individual ingredient to update instantly as I change its amount, so that I get live feedback on the impact of each ingredient.
14. As a user, I want an "extra calories" field for untracked additions (oil spray, a splash of wine, seasoning), so that I can account for cooking additions I don't want to add as full ingredients.
15. As a user, I want a prominent "Total Cooked Weight" field where I enter the weight of the finished dish (after cooking), so that the per-100g calculation uses the real cooked weight.
16. As a user, I want the total cooked weight field to default to the sum of ingredient amounts, so that if I forget to weigh the dish, I still get a reasonable estimate.
17. As a user, I want to see **Nutrition per 100g** update in real time as I change ingredient amounts, extra calories, and cooked weight, so that the calculation is always current.
18. As a user, I want the per-100g panel to show: kcal, protein, fat, carbohydrates, fiber, and sodium, so that I have the full macro picture.
19. As a user, I want a large, prominent display of total kcal for the whole batch and total cooked weight, so that I can sanity-check the calculation at a glance.
20. As a user, I want a **"How much am I eating?"** section at the bottom of Cooking Mode where I enter a portion weight in grams, so that I can immediately calculate the nutrition for the portion I'm about to eat.
21. As a user, I want the portion calculator to output total kcal, protein, fat, carbs for that specific portion weight, so that I know exactly what I'm logging.
22. As a user, I want a **"Log this portion"** button that pre-fills a meal log entry with the calculated nutrition for the portion I just weighed, so that logging a cooked meal is one tap after weighing.
23. As a user, I want the app to remember the cooked weight I entered for a recipe this session, so that if I log multiple portions from the same batch, I don't have to re-enter the weight.
24. As a user, I want a "Save cook result" option that stores the total cooked weight against the recipe as the "last cooked weight", so that it auto-fills as a suggestion next time.
25. As a user, I want to use Cooking Mode in an ad-hoc way (without a pre-saved recipe) by starting from a blank ingredient list, so that one-off dishes don't require creating a saved recipe first.

### Recipe Detail View
26. As a user, I want to view a recipe's ingredient list (ingredients + template amounts) in a read-only detail view, so that I can check the recipe blueprint without entering Cooking Mode. Per-100g nutrition is only available inside Cooking Mode after entering a cooked weight.
27. As a user, I want the recipe detail view to show the recipe's creation date and last cooked date, so that I can see how active the recipe is.

## Implementation Decisions

### Recipe Data Model

**Recipe** (template only — no stored nutrition values)
```
id, owner_id (FK → User), name, description,
last_cooked_at, last_cooked_weight_g (float, nullable),
created_at, updated_at
```

**RecipeIngredient** (join table)
```
id, recipe_id (FK), ingredient_id (FK),
amount (float),          -- amount in the ingredient's own unit
display_order (int)      -- for ordered ingredient list
```

No nutrition is persisted on the recipe itself — it is always computed at cook-time. `last_cooked_weight_g` is a UX convenience hint only.

### Nutrition Calculation — Core Logic

The calculation is a pure function with no side effects, taken from the prototype and formalised:

```python
# From calorie-counter prototype (recipe.py) — the authoritative calculation:
def calculate_nutrition(
    ingredients: list[tuple[Ingredient, float]],  # (ingredient, amount_in_its_unit)
    extra_kcal: float,
    cooked_weight_g: float
) -> NutritionResult:
    totals = {field: 0.0 for field in MACRO_FIELDS}
    for ingredient, amount in ingredients:
        ratio = amount / ingredient.portion_size
        totals["kcal"] += ingredient.kcal * ratio
        for macro in ["protein", "fat", "carbohydrates", "fiber", "sodium"]:
            totals[macro] += getattr(ingredient, macro) * ratio
    totals["kcal"] += extra_kcal
    per_100g = {k: (v / cooked_weight_g) * 100 for k, v in totals.items()}
    return NutritionResult(totals=totals, per_100g=per_100g)
```

This logic must exist as an isolated, tested module on **both** backend (Python) and frontend (TypeScript). The frontend version powers the real-time UI; the backend version is the source of truth when a portion is logged.

### API Endpoints

```
GET    /recipes                     — list user's recipes (name, last_cooked_at, id)
POST   /recipes                     — create recipe (name, description, ingredients)
GET    /recipes/{id}                — recipe detail with ingredients
PATCH  /recipes/{id}                — update recipe metadata or ingredients
DELETE /recipes/{id}                — delete recipe
POST   /recipes/{id}/duplicate      — duplicate recipe, returns new recipe id

POST   /recipes/{id}/cook           — submit a cook session:
                                      { ingredient_amounts, extra_kcal, cooked_weight_g }
                                      returns full NutritionResult + updates last_cooked_*
                                      does NOT create a meal log entry automatically

POST   /recipes/{id}/calculate      — stateless calculation (no DB write):
                                      same input as /cook, returns NutritionResult
                                      used for real-time preview (debounced)
```

The `/calculate` endpoint exists so the backend can validate and compute nutrition server-side even during the live editing session, as a fallback or for server-side logging validation. The frontend does the real-time calculation client-side for zero-latency UX.

### Cooking Mode UX Architecture (Frontend)
- Cooking Mode is a full-screen view (replaces the recipe list in the viewport on mobile)
- State is managed locally in a React component with `useReducer` — the cooking session is ephemeral until explicitly saved or logged
- Ingredient amount inputs use large number inputs (`inputmode="decimal"`) for mobile numeric keyboard
- Per-100g nutrition recalculates synchronously on every keystroke (pure TS function, no debounce needed)
- The "Log this portion" action calls `POST /meal-logs` with pre-computed nutrition values from the frontend, validated server-side
- Ad-hoc Cooking Mode (no pre-saved recipe): starts with an empty ingredient list and the same UI; does not offer a "save recipe" flow in the same screen (a "Save as Recipe" secondary action is available)
- **Frontend-design skill must be invoked** for the Cooking Mode UI — this is the hero screen and must be exceptionally well-designed for one-handed mobile use

### Recipe List UX
- Default sort: last cooked (most recent first), with a secondary sort by name for never-cooked recipes
- Recipe cards show: name, last cooked date (or "Never cooked"), ingredient count
- FAB (Floating Action Button) for "New Recipe" on mobile
- Swipe-to-delete on recipe cards (mobile) with undo toast

## Testing Decisions

### What makes a good test here
Test the nutrition calculation with boundary cases. Test API access control. Do not test React rendering details.

### Backend (pytest)
- **Nutrition calculator (unit tests — highest priority)**: correct per-100g output for a known set of ingredients; extra_kcal is included; cooked weight different from sum of ingredients; single ingredient; zero cooked weight raises a clear error
- **Recipe CRUD**: user can only read/edit/delete their own recipes; another user's recipe returns 404 (not 403, to avoid information leakage)
- **Cook endpoint**: persists last_cooked_at and last_cooked_weight_g; returns correct NutritionResult
- **Calculate endpoint**: stateless — does not write to DB, returns same result as cook endpoint calculation

### Frontend (Jest + React Testing Library)
- Nutrition calculation pure function: same boundary cases as backend
- Cooking Mode: changing an ingredient amount updates per-100g display; changing cooked weight updates per-100g display; "Log this portion" button is disabled when portion weight is 0

## Out of Scope

- Shared/public recipes (strictly private per user — see grill decisions)
- Recipe versioning / change history
- Recipe photos or media attachments
- Nutritional goals checking during recipe building (that's PRD 02)
- Barcode scanning for ingredients
- Importing recipes from URLs or other apps
- Scaling a recipe (e.g. "make 2x this") — the Cooking Mode ingredient amounts can be manually doubled; explicit scaling is a v2 feature

## Further Notes

- The Cooking Mode is the primary daily-use screen. Every design and performance decision should optimise for **speed on mobile, one-handed, while actively cooking**. Large tap targets, minimal scrolling, immediate feedback.
- The prototype's Vue `CookingView.vue` has the correct real-time calculation logic and UX pattern — the React rewrite should preserve the same interaction model but significantly elevate the visual design and mobile ergonomics.
- Consider using `useDeferredValue` or `startTransition` for the ingredient search autocomplete to keep the amount inputs feeling instant.
- The "extra calories" field from the prototype is a valuable UX feature — many cooking additions (oil spray, a knob of butter added at the end) are hard to weigh precisely and are better estimated as a flat kcal addition.
