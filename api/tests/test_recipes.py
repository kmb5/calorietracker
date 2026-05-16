"""Tests for Recipe CRUD endpoints."""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from conftest import auth_headers, register_and_login


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def create_system_ingredient(
    db_session: AsyncSession, name: str = "Chicken breast"
) -> int:
    """Insert a system ingredient and return its id."""
    from app.models.ingredient import Ingredient, UnitType

    ing = Ingredient(
        name=name,
        unit=UnitType.g,
        portion_size=100.0,
        kcal=165.0,
        protein=31.0,
        fat=3.6,
        carbohydrates=0.0,
        fiber=0.0,
        sodium=0.074,
        is_system=True,
        owner_id=None,
    )
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)
    return ing.id


async def create_custom_ingredient(
    db_session: AsyncSession, owner_id: int, name: str = "Secret sauce"
) -> int:
    """Insert a private custom ingredient and return its id."""
    from app.models.ingredient import Ingredient, UnitType

    ing = Ingredient(
        name=name,
        unit=UnitType.ml,
        portion_size=15.0,
        kcal=50.0,
        protein=0.0,
        fat=5.0,
        carbohydrates=2.0,
        fiber=0.0,
        sodium=0.1,
        is_system=False,
        owner_id=owner_id,
    )
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)
    return ing.id


@pytest_asyncio.fixture
async def alice_token(client: AsyncClient) -> str:
    return await register_and_login(client, username="alice")


@pytest_asyncio.fixture
async def bob_token(client: AsyncClient) -> str:
    return await register_and_login(client, username="bob")


@pytest_asyncio.fixture
async def alice_id(alice_token: str, db_session: AsyncSession) -> int:
    from sqlalchemy import select

    from app.models.user import User

    result = await db_session.execute(select(User).where(User.username == "alice"))
    return result.scalar_one().id


@pytest_asyncio.fixture
async def bob_id(bob_token: str, db_session: AsyncSession) -> int:
    from sqlalchemy import select

    from app.models.user import User

    result = await db_session.execute(select(User).where(User.username == "bob"))
    return result.scalar_one().id


# ---------------------------------------------------------------------------
# POST /recipes — create
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_recipe_no_ingredients(
    client: AsyncClient, alice_token: str
) -> None:
    resp = await client.post(
        "/recipes",
        json={"name": "Simple recipe", "description": "A basic recipe"},
        headers=auth_headers(alice_token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Simple recipe"
    assert data["description"] == "A basic recipe"
    assert data["ingredients"] == []
    assert "id" in data


@pytest.mark.asyncio
async def test_create_recipe_with_ingredients(
    client: AsyncClient,
    alice_token: str,
    db_session: AsyncSession,
) -> None:
    ing_id = await create_system_ingredient(db_session)
    resp = await client.post(
        "/recipes",
        json={
            "name": "Chicken dish",
            "ingredients": [
                {"ingredient_id": ing_id, "amount": 200.0, "display_order": 0}
            ],
        },
        headers=auth_headers(alice_token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["ingredients"]) == 1
    assert data["ingredients"][0]["ingredient_id"] == ing_id
    assert data["ingredients"][0]["amount"] == 200.0


@pytest.mark.asyncio
async def test_create_recipe_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/recipes", json={"name": "No auth"})
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_recipe_with_other_users_private_ingredient_returns_400(
    client: AsyncClient,
    alice_token: str,
    bob_id: int,
    db_session: AsyncSession,
) -> None:
    # bob's private ingredient
    ing_id = await create_custom_ingredient(db_session, owner_id=bob_id)
    resp = await client.post(
        "/recipes",
        json={
            "name": "Bad recipe",
            "ingredients": [{"ingredient_id": ing_id, "amount": 50.0}],
        },
        headers=auth_headers(alice_token),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_recipe_with_own_private_ingredient_ok(
    client: AsyncClient,
    alice_token: str,
    alice_id: int,
    db_session: AsyncSession,
) -> None:
    ing_id = await create_custom_ingredient(db_session, owner_id=alice_id)
    resp = await client.post(
        "/recipes",
        json={
            "name": "Alice's private recipe",
            "ingredients": [{"ingredient_id": ing_id, "amount": 30.0}],
        },
        headers=auth_headers(alice_token),
    )
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# GET /recipes/{id} — detail
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_recipe_detail(
    client: AsyncClient,
    alice_token: str,
    db_session: AsyncSession,
) -> None:
    ing_id = await create_system_ingredient(db_session)
    create_resp = await client.post(
        "/recipes",
        json={
            "name": "Detail test",
            "ingredients": [
                {"ingredient_id": ing_id, "amount": 150.0, "display_order": 0}
            ],
        },
        headers=auth_headers(alice_token),
    )
    recipe_id = create_resp.json()["id"]

    resp = await client.get(f"/recipes/{recipe_id}", headers=auth_headers(alice_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == recipe_id
    assert data["name"] == "Detail test"
    assert len(data["ingredients"]) == 1
    # ingredient detail embedded
    assert "ingredient" in data["ingredients"][0]
    assert data["ingredients"][0]["ingredient"]["id"] == ing_id


@pytest.mark.asyncio
async def test_get_recipe_another_users_returns_404(
    client: AsyncClient,
    alice_token: str,
    bob_token: str,
) -> None:
    create_resp = await client.post(
        "/recipes",
        json={"name": "Alice only"},
        headers=auth_headers(alice_token),
    )
    recipe_id = create_resp.json()["id"]

    # Bob tries to read Alice's recipe
    resp = await client.get(f"/recipes/{recipe_id}", headers=auth_headers(bob_token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_recipe_not_found(client: AsyncClient, alice_token: str) -> None:
    resp = await client.get("/recipes/999999", headers=auth_headers(alice_token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /recipes — list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_recipes_only_own(
    client: AsyncClient,
    alice_token: str,
    bob_token: str,
) -> None:
    await client.post(
        "/recipes", json={"name": "Alice recipe"}, headers=auth_headers(alice_token)
    )
    await client.post(
        "/recipes", json={"name": "Bob recipe"}, headers=auth_headers(bob_token)
    )

    resp = await client.get("/recipes", headers=auth_headers(alice_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Alice recipe"


@pytest.mark.asyncio
async def test_list_recipes_sorted_by_last_cooked_desc_nulls_last(
    client: AsyncClient,
    alice_token: str,
    db_session: AsyncSession,
) -> None:
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.models.recipe import Recipe

    # Create two recipes
    r1 = await client.post(
        "/recipes", json={"name": "Zucchini dish"}, headers=auth_headers(alice_token)
    )
    r2 = await client.post(
        "/recipes", json={"name": "Apple pie"}, headers=auth_headers(alice_token)
    )
    r3 = await client.post(
        "/recipes", json={"name": "Beef stew"}, headers=auth_headers(alice_token)
    )

    # Manually set last_cooked_at for r1
    result = await db_session.execute(select(Recipe).where(Recipe.id == r1.json()["id"]))
    recipe = result.scalar_one()
    recipe.last_cooked_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    await db_session.commit()

    result2 = await db_session.execute(select(Recipe).where(Recipe.id == r2.json()["id"]))
    recipe2 = result2.scalar_one()
    recipe2.last_cooked_at = datetime(2024, 6, 1, tzinfo=timezone.utc)
    await db_session.commit()

    resp = await client.get("/recipes", headers=auth_headers(alice_token))
    assert resp.status_code == 200
    names = [r["name"] for r in resp.json()]
    # r2 (June) before r1 (January), never-cooked (r3: Beef stew) last
    assert names[0] == "Apple pie"
    assert names[1] == "Zucchini dish"
    assert names[2] == "Beef stew"


# ---------------------------------------------------------------------------
# PATCH /recipes/{id} — update
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_recipe_name(
    client: AsyncClient, alice_token: str
) -> None:
    create_resp = await client.post(
        "/recipes", json={"name": "Old name"}, headers=auth_headers(alice_token)
    )
    recipe_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/recipes/{recipe_id}",
        json={"name": "New name"},
        headers=auth_headers(alice_token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New name"


@pytest.mark.asyncio
async def test_patch_recipe_replaces_ingredient_list(
    client: AsyncClient,
    alice_token: str,
    db_session: AsyncSession,
) -> None:
    ing1 = await create_system_ingredient(db_session, name="Ingredient A")
    ing2 = await create_system_ingredient(db_session, name="Ingredient B")

    create_resp = await client.post(
        "/recipes",
        json={
            "name": "Update test",
            "ingredients": [{"ingredient_id": ing1, "amount": 100.0, "display_order": 0}],
        },
        headers=auth_headers(alice_token),
    )
    recipe_id = create_resp.json()["id"]

    # Replace ingredient list
    resp = await client.patch(
        f"/recipes/{recipe_id}",
        json={
            "ingredients": [
                {"ingredient_id": ing2, "amount": 200.0, "display_order": 0}
            ]
        },
        headers=auth_headers(alice_token),
    )
    assert resp.status_code == 200
    ings = resp.json()["ingredients"]
    assert len(ings) == 1
    assert ings[0]["ingredient_id"] == ing2


@pytest.mark.asyncio
async def test_patch_recipe_another_users_returns_404(
    client: AsyncClient,
    alice_token: str,
    bob_token: str,
) -> None:
    create_resp = await client.post(
        "/recipes", json={"name": "Alice's"}, headers=auth_headers(alice_token)
    )
    recipe_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/recipes/{recipe_id}",
        json={"name": "Bob's attempt"},
        headers=auth_headers(bob_token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /recipes/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_recipe(
    client: AsyncClient,
    alice_token: str,
    db_session: AsyncSession,
) -> None:
    ing_id = await create_system_ingredient(db_session)
    create_resp = await client.post(
        "/recipes",
        json={
            "name": "To delete",
            "ingredients": [{"ingredient_id": ing_id, "amount": 100.0}],
        },
        headers=auth_headers(alice_token),
    )
    recipe_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/recipes/{recipe_id}", headers=auth_headers(alice_token)
    )
    assert del_resp.status_code == 204

    # Verify gone
    get_resp = await client.get(
        f"/recipes/{recipe_id}", headers=auth_headers(alice_token)
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_recipe_another_users_returns_404(
    client: AsyncClient,
    alice_token: str,
    bob_token: str,
) -> None:
    create_resp = await client.post(
        "/recipes", json={"name": "Alice only"}, headers=auth_headers(alice_token)
    )
    recipe_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/recipes/{recipe_id}", headers=auth_headers(bob_token)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /recipes/{id}/duplicate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_duplicate_recipe(
    client: AsyncClient,
    alice_token: str,
    db_session: AsyncSession,
) -> None:
    ing_id = await create_system_ingredient(db_session)
    create_resp = await client.post(
        "/recipes",
        json={
            "name": "Original",
            "description": "Desc",
            "ingredients": [{"ingredient_id": ing_id, "amount": 100.0, "display_order": 0}],
        },
        headers=auth_headers(alice_token),
    )
    original_id = create_resp.json()["id"]

    dup_resp = await client.post(
        f"/recipes/{original_id}/duplicate", headers=auth_headers(alice_token)
    )
    assert dup_resp.status_code == 201
    new_id = dup_resp.json()["id"]
    assert new_id != original_id

    # Original unchanged
    orig = await client.get(f"/recipes/{original_id}", headers=auth_headers(alice_token))
    assert orig.json()["name"] == "Original"

    # Duplicate has correct name and ingredients
    dup = await client.get(f"/recipes/{new_id}", headers=auth_headers(alice_token))
    assert dup.json()["name"] == "Copy of Original"
    assert dup.json()["description"] == "Desc"
    assert len(dup.json()["ingredients"]) == 1
    assert dup.json()["ingredients"][0]["ingredient_id"] == ing_id


@pytest.mark.asyncio
async def test_duplicate_recipe_another_users_returns_404(
    client: AsyncClient,
    alice_token: str,
    bob_token: str,
) -> None:
    create_resp = await client.post(
        "/recipes", json={"name": "Alice's"}, headers=auth_headers(alice_token)
    )
    recipe_id = create_resp.json()["id"]

    resp = await client.post(
        f"/recipes/{recipe_id}/duplicate", headers=auth_headers(bob_token)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# ingredients ordered by display_order
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_recipe_ingredients_ordered_by_display_order(
    client: AsyncClient,
    alice_token: str,
    db_session: AsyncSession,
) -> None:
    ing1 = await create_system_ingredient(db_session, name="First ing")
    ing2 = await create_system_ingredient(db_session, name="Second ing")
    ing3 = await create_system_ingredient(db_session, name="Third ing")

    resp = await client.post(
        "/recipes",
        json={
            "name": "Order test",
            "ingredients": [
                {"ingredient_id": ing3, "amount": 10.0, "display_order": 2},
                {"ingredient_id": ing1, "amount": 10.0, "display_order": 0},
                {"ingredient_id": ing2, "amount": 10.0, "display_order": 1},
            ],
        },
        headers=auth_headers(alice_token),
    )
    assert resp.status_code == 201
    ings = resp.json()["ingredients"]
    orders = [i["display_order"] for i in ings]
    assert orders == [0, 1, 2]
