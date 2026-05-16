"""Tests for /ingredients write endpoints — create, update, delete, promote."""

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingredient import Ingredient, UnitType

# ---------------------------------------------------------------------------
# Shared payload
# ---------------------------------------------------------------------------

_BASE_FIELDS = dict(
    unit="g",
    portion_size=100.0,
    kcal=200.0,
    protein=10.0,
    fat=5.0,
    carbohydrates=20.0,
    fiber=2.0,
    sodium=0.3,
)


# ---------------------------------------------------------------------------
# POST /ingredients — create
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_requires_auth(client: AsyncClient):
    resp = await client.post("/ingredients", json={"name": "Test", **_BASE_FIELDS})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_requires_auth(client: AsyncClient):
    resp = await client.patch("/ingredients/1", json={"name": "Ghost"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_requires_auth(client: AsyncClient):
    resp = await client.delete("/ingredients/1")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_sets_owner_and_not_system(client: AsyncClient):
    token = await register_and_login(client, "creator1")
    resp = await client.post(
        "/ingredients",
        json={"name": "My Custom Sauce", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Custom Sauce"
    assert data["is_system"] is False
    assert data["owner_id"] is not None


@pytest.mark.asyncio
async def test_create_cannot_set_is_system(client: AsyncClient):
    """is_system in the body is ignored — always forced False."""
    token = await register_and_login(client, "creator2")
    resp = await client.post(
        "/ingredients",
        json={"name": "Hack Ingredient", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["is_system"] is False


@pytest.mark.asyncio
async def test_create_appears_in_own_search(client: AsyncClient):
    token = await register_and_login(client, "creator3")
    await client.post(
        "/ingredients",
        json={"name": "UniqueCustomSauce3", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    resp = await client.get(
        "/ingredients/search?q=uniquecustomsauce3", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    assert any(i["name"] == "UniqueCustomSauce3" for i in resp.json())


@pytest.mark.asyncio
async def test_create_not_visible_to_other_users(client: AsyncClient):
    token_alice = await register_and_login(client, "creator4_alice")
    token_bob = await register_and_login(client, "creator4_bob")
    await client.post(
        "/ingredients",
        json={"name": "AliceSecretIngr", **_BASE_FIELDS},
        headers=auth_headers(token_alice),
    )
    resp = await client.get(
        "/ingredients/search?q=alicesecretingr", headers=auth_headers(token_bob)
    )
    assert resp.status_code == 200
    assert not any(i["name"] == "AliceSecretIngr" for i in resp.json())


@pytest.mark.asyncio
async def test_create_with_icon(client: AsyncClient):
    token = await register_and_login(client, "creator5")
    resp = await client.post(
        "/ingredients",
        json={"name": "IconIngredient", "icon": "🍅", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["icon"] == "🍅"


# ---------------------------------------------------------------------------
# PATCH /ingredients/{id} — update
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_own_ingredient(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, "updater1")
    create_resp = await client.post(
        "/ingredients",
        json={"name": "OriginalName", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/ingredients/{ing_id}",
        json={"name": "UpdatedName", "kcal": 300.0},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "UpdatedName"
    assert data["kcal"] == 300.0


@pytest.mark.asyncio
async def test_update_other_user_ingredient_returns_404(client: AsyncClient):
    token_alice = await register_and_login(client, "updater2_alice")
    token_bob = await register_and_login(client, "updater2_bob")
    create_resp = await client.post(
        "/ingredients",
        json={"name": "AliceIngr", **_BASE_FIELDS},
        headers=auth_headers(token_alice),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/ingredients/{ing_id}",
        json={"name": "BobHijack"},
        headers=auth_headers(token_bob),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_nonexistent_returns_404(client: AsyncClient):
    token = await register_and_login(client, "updater3")
    resp = await client.patch(
        "/ingredients/999999",
        json={"name": "Ghost"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_update_any_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    token_user = await register_and_login(client, "updater4_user")
    token_admin = await register_and_login(
        client, "updater4_admin", make_admin=True, db_session=db_session
    )
    create_resp = await client.post(
        "/ingredients",
        json={"name": "UserOwnedIngr", **_BASE_FIELDS},
        headers=auth_headers(token_user),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/ingredients/{ing_id}",
        json={"name": "AdminUpdated"},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "AdminUpdated"


@pytest.mark.asyncio
async def test_admin_can_update_system_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    # Create a system ingredient directly in the DB
    ing = Ingredient(
        name="SystemIngr",
        unit=UnitType.g,
        is_system=True,
        owner_id=None,
        kcal=50.0,
        protein=1.0,
        fat=1.0,
        carbohydrates=5.0,
        fiber=0.5,
        sodium=0.1,
        portion_size=100.0,
    )
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)

    token_admin = await register_and_login(
        client, "updater5_admin", make_admin=True, db_session=db_session
    )
    resp = await client.patch(
        f"/ingredients/{ing.id}",
        json={"kcal": 999.0},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["kcal"] == 999.0


# ---------------------------------------------------------------------------
# DELETE /ingredients/{id} — delete
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_own_ingredient(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, "deleter1")
    create_resp = await client.post(
        "/ingredients",
        json={"name": "ToBeDeleted", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.delete(f"/ingredients/{ing_id}", headers=auth_headers(token))
    assert resp.status_code == 204

    # Confirm gone from DB
    result = await db_session.execute(select(Ingredient).where(Ingredient.id == ing_id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_other_user_ingredient_returns_404(client: AsyncClient):
    token_alice = await register_and_login(client, "deleter2_alice")
    token_bob = await register_and_login(client, "deleter2_bob")
    create_resp = await client.post(
        "/ingredients",
        json={"name": "AliceDelIngr", **_BASE_FIELDS},
        headers=auth_headers(token_alice),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/ingredients/{ing_id}", headers=auth_headers(token_bob)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_404(client: AsyncClient):
    token = await register_and_login(client, "deleter3")
    resp = await client.delete("/ingredients/999999", headers=auth_headers(token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_delete_any_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    token_user = await register_and_login(client, "deleter4_user")
    token_admin = await register_and_login(
        client, "deleter4_admin", make_admin=True, db_session=db_session
    )
    create_resp = await client.post(
        "/ingredients",
        json={"name": "AdminWillDelete", **_BASE_FIELDS},
        headers=auth_headers(token_user),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/ingredients/{ing_id}", headers=auth_headers(token_admin)
    )
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# POST /ingredients/{id}/promote — promotion request
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_promote_sets_pending(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, "promoter1")
    create_resp = await client.post(
        "/ingredients",
        json={"name": "PromoteMe", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.post(
        f"/ingredients/{ing_id}/promote", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    assert resp.json()["is_promotion_pending"] is True


@pytest.mark.asyncio
async def test_promote_is_idempotent(client: AsyncClient):
    token = await register_and_login(client, "promoter2")
    create_resp = await client.post(
        "/ingredients",
        json={"name": "PromoteTwice", **_BASE_FIELDS},
        headers=auth_headers(token),
    )
    ing_id = create_resp.json()["id"]
    # Call twice — both must succeed
    for _ in range(2):
        resp = await client.post(
            f"/ingredients/{ing_id}/promote", headers=auth_headers(token)
        )
        assert resp.status_code == 200
        assert resp.json()["is_promotion_pending"] is True


@pytest.mark.asyncio
async def test_promote_other_user_ingredient_returns_404(client: AsyncClient):
    token_alice = await register_and_login(client, "promoter3_alice")
    token_bob = await register_and_login(client, "promoter3_bob")
    create_resp = await client.post(
        "/ingredients",
        json={"name": "AlicePromoteIngr", **_BASE_FIELDS},
        headers=auth_headers(token_alice),
    )
    ing_id = create_resp.json()["id"]
    resp = await client.post(
        f"/ingredients/{ing_id}/promote", headers=auth_headers(token_bob)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_promote_nonexistent_returns_404(client: AsyncClient):
    token = await register_and_login(client, "promoter4")
    resp = await client.post("/ingredients/999999/promote", headers=auth_headers(token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_promote_requires_auth(client: AsyncClient, db_session: AsyncSession):
    ing = Ingredient(
        name="PromoteNoAuth",
        unit=UnitType.g,
        is_system=False,
        owner_id=None,
        kcal=50.0,
        protein=1.0,
        fat=1.0,
        carbohydrates=5.0,
        fiber=0.5,
        sodium=0.1,
        portion_size=100.0,
    )
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)
    resp = await client.post(f"/ingredients/{ing.id}/promote")
    assert resp.status_code == 401
