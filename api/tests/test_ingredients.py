"""Tests for /ingredients/* endpoints — search and detail."""

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingredient import Ingredient, UnitType

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_ingredient(
    session: AsyncSession,
    *,
    name: str,
    unit: UnitType = UnitType.g,
    is_system: bool = True,
    owner_id: int | None = None,
    kcal: float = 100.0,
    portion_size: float = 100.0,
) -> Ingredient:
    ing = Ingredient(
        name=name,
        unit=unit,
        is_system=is_system,
        owner_id=owner_id,
        kcal=kcal,
        protein=5.0,
        fat=2.0,
        carbohydrates=10.0,
        fiber=1.0,
        sodium=0.5,
        portion_size=portion_size,
    )
    session.add(ing)
    await session.commit()
    await session.refresh(ing)
    return ing


# ---------------------------------------------------------------------------
# GET /ingredients/search
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_requires_auth(client: AsyncClient):
    resp = await client.get("/ingredients/search?q=chicken")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_search_returns_system_ingredients(
    client: AsyncClient, db_session: AsyncSession
):
    await _create_ingredient(db_session, name="Chicken Breast", is_system=True)
    token = await register_and_login(client, "user_sys")
    resp = await client.get(
        "/ingredients/search?q=chicken", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "Chicken Breast" in names


@pytest.mark.asyncio
async def test_search_returns_own_custom_ingredients(
    client: AsyncClient, db_session: AsyncSession
):
    token = await register_and_login(client, "user_custom")
    # Look up the user's id via the DB by searching for the registered user
    from sqlalchemy import select

    from app.models.user import User

    result = await db_session.execute(
        select(User).where(User.username == "user_custom")
    )
    user = result.scalar_one()

    await _create_ingredient(
        db_session, name="My Secret Sauce", is_system=False, owner_id=user.id
    )

    resp = await client.get("/ingredients/search?q=secret", headers=auth_headers(token))
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "My Secret Sauce" in names


@pytest.mark.asyncio
async def test_search_excludes_other_users_custom_ingredients(
    client: AsyncClient, db_session: AsyncSession
):
    # Register alice (owner) and bob (searcher)
    token_alice = await register_and_login(client, "alice_excl")
    token_bob = await register_and_login(client, "bob_excl")

    from sqlalchemy import select

    from app.models.user import User

    result = await db_session.execute(select(User).where(User.username == "alice_excl"))
    alice = result.scalar_one()

    await _create_ingredient(
        db_session, name="Alice Private Ingredient", is_system=False, owner_id=alice.id
    )

    # Bob should NOT see Alice's private ingredient
    resp = await client.get(
        "/ingredients/search?q=alice+private", headers=auth_headers(token_bob)
    )
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "Alice Private Ingredient" not in names

    # Alice herself CAN see it
    resp = await client.get(
        "/ingredients/search?q=alice+private", headers=auth_headers(token_alice)
    )
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "Alice Private Ingredient" in names


@pytest.mark.asyncio
async def test_search_prefix_matches_before_substring(
    client: AsyncClient, db_session: AsyncSession
):
    # Seed more than the default limit (20) of substring-only matches first so
    # that a DB-level LIMIT applied before sorting would swallow the prefix match.
    # "Chicken Fillet" (prefix match) is inserted LAST — a naive LIMIT 20 on the
    # first 20 DB rows would exclude it entirely, proving the bug.
    for i in range(22):
        await _create_ingredient(
            db_session, name=f"Grilled Raw Chicken Variant {i:02d}", is_system=True
        )
    await _create_ingredient(db_session, name="Chicken Fillet", is_system=True)

    token = await register_and_login(client, "user_rank")
    resp = await client.get(
        "/ingredients/search?q=chicken&limit=20", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    results = resp.json()
    names = [i["name"] for i in results]
    # Prefix match must be first regardless of insertion order
    assert names[0] == "Chicken Fillet"
    # Total returned must be capped at limit
    assert len(results) == 20


@pytest.mark.asyncio
async def test_search_unit_filter(client: AsyncClient, db_session: AsyncSession):
    await _create_ingredient(
        db_session, name="Olive Oil Search", is_system=True, unit=UnitType.ml
    )
    await _create_ingredient(
        db_session, name="Olive Spread Search", is_system=True, unit=UnitType.g
    )

    token = await register_and_login(client, "user_unit")
    resp = await client.get(
        "/ingredients/search?q=olive&unit=ml", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    results = resp.json()
    names = [i["name"] for i in results]
    assert "Olive Oil Search" in names
    assert "Olive Spread Search" not in names


@pytest.mark.asyncio
async def test_search_result_fields(client: AsyncClient, db_session: AsyncSession):
    await _create_ingredient(
        db_session, name="TestFieldIngredient", is_system=True, kcal=250.0
    )
    token = await register_and_login(client, "user_fields")
    resp = await client.get(
        "/ingredients/search?q=testfieldingredient", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    item = resp.json()[0]
    assert set(item.keys()) == {
        "id",
        "name",
        "unit",
        "portion_size",
        "kcal",
        "is_system",
        "icon",
    }


# ---------------------------------------------------------------------------
# GET /ingredients/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_detail_requires_auth(client: AsyncClient, db_session: AsyncSession):
    ing = await _create_ingredient(
        db_session, name="DetailAuthIngredient", is_system=True
    )
    resp = await client.get(f"/ingredients/{ing.id}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_detail_returns_all_fields(client: AsyncClient, db_session: AsyncSession):
    ing = await _create_ingredient(db_session, name="DetailAllFields", is_system=True)
    token = await register_and_login(client, "user_detail")
    resp = await client.get(f"/ingredients/{ing.id}", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    expected_keys = {
        "id",
        "name",
        "unit",
        "portion_size",
        "kcal",
        "protein",
        "fat",
        "carbohydrates",
        "fiber",
        "sodium",
        "is_system",
        "owner_id",
        "icon",
        "is_promotion_pending",
    }
    assert set(data.keys()) == expected_keys


@pytest.mark.asyncio
async def test_detail_not_found(client: AsyncClient):
    token = await register_and_login(client, "user_notfound")
    resp = await client.get("/ingredients/999999", headers=auth_headers(token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_detail_own_custom_ingredient_allowed(
    client: AsyncClient, db_session: AsyncSession
):
    token = await register_and_login(client, "user_own_ing")
    from sqlalchemy import select

    from app.models.user import User

    result = await db_session.execute(
        select(User).where(User.username == "user_own_ing")
    )
    user = result.scalar_one()

    ing = await _create_ingredient(
        db_session, name="My Private Ing", is_system=False, owner_id=user.id
    )
    resp = await client.get(f"/ingredients/{ing.id}", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["name"] == "My Private Ing"


@pytest.mark.asyncio
async def test_detail_other_user_private_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    await register_and_login(client, "alice_detail")
    token_bob = await register_and_login(client, "bob_detail")

    from sqlalchemy import select

    from app.models.user import User

    result = await db_session.execute(
        select(User).where(User.username == "alice_detail")
    )
    alice = result.scalar_one()

    ing = await _create_ingredient(
        db_session, name="Alice Only Ingredient", is_system=False, owner_id=alice.id
    )

    # Bob requests Alice's private ingredient — must get 404, not 403
    resp = await client.get(f"/ingredients/{ing.id}", headers=auth_headers(token_bob))
    assert resp.status_code == 404
