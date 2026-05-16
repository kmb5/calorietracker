"""Tests for /recipes/{id}/calculate and /recipes/{id}/cook endpoints."""

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def create_ingredient(db_session: AsyncSession, **kwargs) -> int:
    """Helper: insert a test ingredient and return its id."""
    from app.models.ingredient import Ingredient, UnitType

    defaults = dict(
        name="Test Chicken",
        unit=UnitType.g,
        portion_size=100.0,
        kcal=165.0,
        protein=31.0,
        fat=3.6,
        carbohydrates=0.0,
        fiber=0.0,
        sodium=0.074,
        is_system=True,
    )
    defaults.update(kwargs)
    ing = Ingredient(**defaults)
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)
    return ing.id


async def create_recipe(
    client: AsyncClient, token: str, name: str = "Test Recipe"
) -> int:
    """Helper: create a recipe and return its id."""
    resp = await client.post(
        "/recipes",
        json={"name": name, "description": None, "ingredients": []},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# /calculate tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_calculate_returns_nutrition_result(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await register_and_login(client, "alice")
    ing_id = await create_ingredient(
        db_session,
        name="Chicken",
        kcal=165.0,
        protein=31.0,
        fat=3.6,
        carbohydrates=0.0,
        fiber=0.0,
        sodium=0.074,
    )
    recipe_id = await create_recipe(client, token)

    resp = await client.post(
        f"/recipes/{recipe_id}/calculate",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 200.0, "display_order": 0}
            ],
            "extra_kcal": 0.0,
            "cooked_weight_g": 180.0,
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "totals" in data
    assert "per_100g" in data
    # totals: 165 * 2 = 330 kcal, 31 * 2 = 62 g protein
    assert data["totals"]["kcal"] == pytest.approx(330.0)
    assert data["totals"]["protein"] == pytest.approx(62.0)
    # per_100g: 330/180*100
    assert data["per_100g"]["kcal"] == pytest.approx(330.0 / 180.0 * 100, rel=1e-4)


@pytest.mark.asyncio
async def test_calculate_does_not_modify_db(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """POST /calculate must NOT change last_cooked_at or last_cooked_weight_g."""
    from sqlalchemy import select

    from app.models.recipe import Recipe

    token = await register_and_login(client, "alice2")
    ing_id = await create_ingredient(
        db_session,
        name="Rice",
        kcal=130.0,
        protein=2.7,
        fat=0.3,
        carbohydrates=28.0,
        fiber=0.4,
        sodium=0.001,
    )
    recipe_id = await create_recipe(client, token, name="Rice Dish")

    await client.post(
        f"/recipes/{recipe_id}/calculate",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 100.0, "display_order": 0}
            ],
            "extra_kcal": 0.0,
            "cooked_weight_g": 90.0,
        },
        headers=auth_headers(token),
    )

    result = await db_session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one()
    assert recipe.last_cooked_at is None
    assert recipe.last_cooked_weight_g is None


@pytest.mark.asyncio
async def test_calculate_with_extra_kcal(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await register_and_login(client, "alice3")
    ing_id = await create_ingredient(
        db_session,
        name="Veggie",
        kcal=50.0,
        protein=1.0,
        fat=0.0,
        carbohydrates=10.0,
        fiber=2.0,
        sodium=0.0,
    )
    recipe_id = await create_recipe(client, token, name="Veggie Dish")

    resp = await client.post(
        f"/recipes/{recipe_id}/calculate",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 100.0, "display_order": 0}
            ],
            "extra_kcal": 50.0,
            "cooked_weight_g": 100.0,
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["totals"]["kcal"] == pytest.approx(100.0)  # 50 + 50
    assert data["per_100g"]["kcal"] == pytest.approx(100.0)  # 100/100*100


@pytest.mark.asyncio
async def test_calculate_404_for_other_users_recipe(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token_a = await register_and_login(client, "alice4")
    token_b = await register_and_login(client, "bob4")
    recipe_id = await create_recipe(client, token_a, name="Alice's Recipe")
    ing_id = await create_ingredient(
        db_session,
        name="Oil",
        kcal=884.0,
        protein=0.0,
        fat=100.0,
        carbohydrates=0.0,
        fiber=0.0,
        sodium=0.0,
    )

    resp = await client.post(
        f"/recipes/{recipe_id}/calculate",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 10.0, "display_order": 0}
            ],
            "extra_kcal": 0.0,
            "cooked_weight_g": 10.0,
        },
        headers=auth_headers(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_calculate_requires_auth(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await register_and_login(client, "alice5")
    recipe_id = await create_recipe(client, token, name="Recipe 5")
    ing_id = await create_ingredient(
        db_session,
        name="Beef",
        kcal=250.0,
        protein=26.0,
        fat=17.0,
        carbohydrates=0.0,
        fiber=0.0,
        sodium=0.072,
    )
    resp = await client.post(
        f"/recipes/{recipe_id}/calculate",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 100.0, "display_order": 0}
            ],
            "extra_kcal": 0.0,
            "cooked_weight_g": 80.0,
        },
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# /cook tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cook_returns_nutrition_result(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await register_and_login(client, "chef1")
    ing_id = await create_ingredient(
        db_session,
        name="Egg",
        kcal=155.0,
        protein=13.0,
        fat=11.0,
        carbohydrates=1.1,
        fiber=0.0,
        sodium=0.124,
    )
    recipe_id = await create_recipe(client, token, name="Scrambled Eggs")

    resp = await client.post(
        f"/recipes/{recipe_id}/cook",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 200.0, "display_order": 0}
            ],
            "extra_kcal": 10.0,
            "cooked_weight_g": 180.0,
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    # totals: 155*2 + 10 = 320 kcal
    assert data["totals"]["kcal"] == pytest.approx(320.0)
    assert data["per_100g"]["kcal"] == pytest.approx(320.0 / 180.0 * 100, rel=1e-4)


@pytest.mark.asyncio
async def test_cook_updates_last_cooked(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """POST /cook must update last_cooked_at and last_cooked_weight_g."""
    from sqlalchemy import select

    from app.models.recipe import Recipe

    token = await register_and_login(client, "chef2")
    ing_id = await create_ingredient(
        db_session,
        name="Pasta",
        kcal=131.0,
        protein=5.0,
        fat=1.1,
        carbohydrates=25.0,
        fiber=1.8,
        sodium=0.001,
    )
    recipe_id = await create_recipe(client, token, name="Pasta Dish")

    resp = await client.post(
        f"/recipes/{recipe_id}/cook",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 80.0, "display_order": 0}
            ],
            "extra_kcal": 0.0,
            "cooked_weight_g": 200.0,
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 200

    result = await db_session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one()
    assert recipe.last_cooked_at is not None
    assert recipe.last_cooked_weight_g == pytest.approx(200.0)


@pytest.mark.asyncio
async def test_cook_404_for_other_users_recipe(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token_a = await register_and_login(client, "chef3")
    token_b = await register_and_login(client, "chef4")
    recipe_id = await create_recipe(client, token_a, name="Chef3 Recipe")
    ing_id = await create_ingredient(
        db_session,
        name="Salmon",
        kcal=208.0,
        protein=20.0,
        fat=13.0,
        carbohydrates=0.0,
        fiber=0.0,
        sodium=0.059,
    )

    resp = await client.post(
        f"/recipes/{recipe_id}/cook",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 100.0, "display_order": 0}
            ],
            "extra_kcal": 0.0,
            "cooked_weight_g": 85.0,
        },
        headers=auth_headers(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cook_requires_auth(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await register_and_login(client, "chef5")
    recipe_id = await create_recipe(client, token, name="Chef5 Recipe")
    ing_id = await create_ingredient(
        db_session,
        name="Broccoli",
        kcal=34.0,
        protein=2.8,
        fat=0.4,
        carbohydrates=7.0,
        fiber=2.6,
        sodium=0.033,
    )
    resp = await client.post(
        f"/recipes/{recipe_id}/cook",
        json={
            "ingredient_amounts": [
                {"ingredient_id": ing_id, "amount": 150.0, "display_order": 0}
            ],
            "extra_kcal": 0.0,
            "cooked_weight_g": 140.0,
        },
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Security: private ingredient visibility tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_calculate_rejects_other_users_private_ingredient(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A user must not be able to pass another user's private ingredient ID
    to /calculate and receive their nutrition data back (security fix)."""
    from app.models.ingredient import Ingredient, UnitType

    # Register two users
    token_alice = await register_and_login(client, "sec_alice")
    await register_and_login(client, "sec_bob")

    # Create a private ingredient owned by Bob (not system)
    from sqlalchemy import select as sa_select

    from app.models.user import User

    result = await db_session.execute(sa_select(User).where(User.username == "sec_bob"))
    bob = result.scalar_one()

    private_ing = Ingredient(
        name="Bob's Secret Sauce",
        unit=UnitType.g,
        portion_size=100.0,
        kcal=999.0,
        protein=1.0,
        fat=1.0,
        carbohydrates=1.0,
        fiber=0.0,
        sodium=0.0,
        is_system=False,
        owner_id=bob.id,
    )
    db_session.add(private_ing)
    await db_session.commit()
    await db_session.refresh(private_ing)

    # Alice creates a recipe and tries to use Bob's private ingredient
    recipe_id = await create_recipe(client, token_alice, name="Alice's Recipe")

    resp = await client.post(
        f"/recipes/{recipe_id}/calculate",
        json={
            "ingredient_amounts": [{"ingredient_id": private_ing.id, "amount": 100.0}],
            "extra_kcal": 0.0,
            "cooked_weight_g": 100.0,
        },
        headers=auth_headers(token_alice),
    )
    # Must be rejected — ingredient not visible to Alice
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_cook_rejects_other_users_private_ingredient(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """POST /cook must also reject another user's private ingredient."""
    from sqlalchemy import select as sa_select

    from app.models.ingredient import Ingredient, UnitType
    from app.models.user import User

    token_carol = await register_and_login(client, "sec_carol")
    await register_and_login(client, "sec_dave")

    result = await db_session.execute(
        sa_select(User).where(User.username == "sec_dave")
    )
    dave = result.scalar_one()

    private_ing = Ingredient(
        name="Dave's Private Spice",
        unit=UnitType.g,
        portion_size=100.0,
        kcal=500.0,
        protein=0.0,
        fat=0.0,
        carbohydrates=0.0,
        fiber=0.0,
        sodium=0.0,
        is_system=False,
        owner_id=dave.id,
    )
    db_session.add(private_ing)
    await db_session.commit()
    await db_session.refresh(private_ing)

    recipe_id = await create_recipe(client, token_carol, name="Carol's Recipe")

    resp = await client.post(
        f"/recipes/{recipe_id}/cook",
        json={
            "ingredient_amounts": [{"ingredient_id": private_ing.id, "amount": 50.0}],
            "extra_kcal": 0.0,
            "cooked_weight_g": 45.0,
        },
        headers=auth_headers(token_carol),
    )
    assert resp.status_code == 422, resp.text
