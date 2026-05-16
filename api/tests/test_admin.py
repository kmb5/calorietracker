"""Tests for /admin/* endpoints."""

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingredient import Ingredient, UnitType
from app.models.user import User, UserRole

# ---------------------------------------------------------------------------
# Shared ingredient payload
# ---------------------------------------------------------------------------

_BASE = dict(
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
# Helper: create a pending-promotion ingredient
# ---------------------------------------------------------------------------


async def _create_pending_ingredient(
    client: AsyncClient, token: str, name: str
) -> int:
    create_resp = await client.post(
        "/ingredients",
        json={"name": name, **_BASE},
        headers=auth_headers(token),
    )
    assert create_resp.status_code == 201
    ing_id = create_resp.json()["id"]
    promote_resp = await client.post(
        f"/ingredients/{ing_id}/promote", headers=auth_headers(token)
    )
    assert promote_resp.status_code == 200
    return ing_id


# ===========================================================================
# 403 for non-admin on every admin endpoint
# ===========================================================================


@pytest.mark.asyncio
async def test_admin_endpoints_require_admin_role(client: AsyncClient):
    token = await register_and_login(client, "regular_user_admin_test")
    endpoints = [
        ("GET", "/admin/ingredients/promotions"),
        ("POST", "/admin/ingredients/promotions/1/approve"),
        ("POST", "/admin/ingredients/promotions/1/reject"),
        ("POST", "/admin/ingredients"),
        ("PATCH", "/admin/ingredients/1"),
        ("DELETE", "/admin/ingredients/1"),
        ("POST", "/admin/ingredients/bulk-import"),
        ("GET", "/admin/users"),
        ("PATCH", "/admin/users/1"),
        ("PATCH", "/admin/users/1/role"),
    ]
    for method, url in endpoints:
        kwargs: dict = {"headers": auth_headers(token)}
        if method not in ("GET", "DELETE"):
            kwargs["json"] = {}
        resp = await getattr(client, method.lower())(url, **kwargs)
        assert resp.status_code == 403, f"{method} {url} expected 403, got {resp.status_code}"


@pytest.mark.asyncio
async def test_admin_endpoints_require_auth(client: AsyncClient):
    endpoints = [
        ("GET", "/admin/ingredients/promotions"),
        ("GET", "/admin/users"),
    ]
    for method, url in endpoints:
        resp = await getattr(client, method.lower())(url)
        assert resp.status_code == 401, f"{method} {url} expected 401, got {resp.status_code}"


# ===========================================================================
# Promotion management
# ===========================================================================


@pytest.mark.asyncio
async def test_list_pending_promotions(
    client: AsyncClient, db_session: AsyncSession
):
    token_user = await register_and_login(client, "prom_list_user")
    token_admin = await register_and_login(
        client, "prom_list_admin", make_admin=True, db_session=db_session
    )

    ing_id = await _create_pending_ingredient(client, token_user, "PendingListIngr")

    resp = await client.get(
        "/admin/ingredients/promotions", headers=auth_headers(token_admin)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert any(i["id"] == ing_id and i["is_promotion_pending"] is True for i in data)


@pytest.mark.asyncio
async def test_list_pending_promotions_excludes_non_pending(
    client: AsyncClient, db_session: AsyncSession
):
    token_user = await register_and_login(client, "prom_excl_user")
    token_admin = await register_and_login(
        client, "prom_excl_admin", make_admin=True, db_session=db_session
    )
    # Create ingredient but do NOT promote
    create_resp = await client.post(
        "/ingredients",
        json={"name": "NotPendingIngr", **_BASE},
        headers=auth_headers(token_user),
    )
    ing_id = create_resp.json()["id"]

    resp = await client.get(
        "/admin/ingredients/promotions", headers=auth_headers(token_admin)
    )
    assert resp.status_code == 200
    assert not any(i["id"] == ing_id for i in resp.json())


@pytest.mark.asyncio
async def test_approve_promotion(client: AsyncClient, db_session: AsyncSession):
    token_user = await register_and_login(client, "prom_approve_user")
    token_admin = await register_and_login(
        client, "prom_approve_admin", make_admin=True, db_session=db_session
    )

    ing_id = await _create_pending_ingredient(client, token_user, "ApproveMe")

    resp = await client.post(
        f"/admin/ingredients/promotions/{ing_id}/approve",
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_system"] is True
    assert data["owner_id"] is None
    assert data["is_promotion_pending"] is False


@pytest.mark.asyncio
async def test_approve_makes_ingredient_visible_to_all(
    client: AsyncClient, db_session: AsyncSession
):
    token_user = await register_and_login(client, "prom_vis_user")
    token_other = await register_and_login(client, "prom_vis_other")
    token_admin = await register_and_login(
        client, "prom_vis_admin", make_admin=True, db_session=db_session
    )

    ing_id = await _create_pending_ingredient(client, token_user, "VisibleAfterApprove")

    # Before approval: not visible to other user
    resp = await client.get(
        "/ingredients/search?q=VisibleAfterApprove", headers=auth_headers(token_other)
    )
    assert not any(i["id"] == ing_id for i in resp.json())

    # Approve
    await client.post(
        f"/admin/ingredients/promotions/{ing_id}/approve",
        headers=auth_headers(token_admin),
    )

    # After approval: visible to other user
    resp = await client.get(
        "/ingredients/search?q=VisibleAfterApprove", headers=auth_headers(token_other)
    )
    assert any(i["id"] == ing_id for i in resp.json())


@pytest.mark.asyncio
async def test_approve_non_pending_returns_400(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "prom_app_np_admin", make_admin=True, db_session=db_session
    )
    # Create a system ingredient with no pending promotion
    ing = Ingredient(
        name="NotPendingSystem",
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

    resp = await client.post(
        f"/admin/ingredients/promotions/{ing.id}/approve",
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reject_promotion(client: AsyncClient, db_session: AsyncSession):
    token_user = await register_and_login(client, "prom_reject_user")
    token_admin = await register_and_login(
        client, "prom_reject_admin", make_admin=True, db_session=db_session
    )

    ing_id = await _create_pending_ingredient(client, token_user, "RejectMe")

    resp = await client.post(
        f"/admin/ingredients/promotions/{ing_id}/reject",
        json={"rejection_note": "Too generic, please add more detail"},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_promotion_pending"] is False
    assert data["promotion_rejection_note"] == "Too generic, please add more detail"
    # is_system stays False
    assert data["is_system"] is False


@pytest.mark.asyncio
async def test_reject_non_pending_returns_400(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "prom_rej_np_admin", make_admin=True, db_session=db_session
    )
    ing = Ingredient(
        name="NotPendingIngr2",
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

    resp = await client.post(
        f"/admin/ingredients/promotions/{ing.id}/reject",
        json={"rejection_note": "n/a"},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 400


# ===========================================================================
# System ingredient CRUD
# ===========================================================================


@pytest.mark.asyncio
async def test_admin_create_system_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "admin_create_sys", make_admin=True, db_session=db_session
    )

    resp = await client.post(
        "/admin/ingredients",
        json={"name": "AdminCreatedIngr", **_BASE},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_system"] is True
    assert data["owner_id"] is None
    assert data["name"] == "AdminCreatedIngr"


@pytest.mark.asyncio
async def test_admin_update_any_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    token_user = await register_and_login(client, "admin_upd_user")
    token_admin = await register_and_login(
        client, "admin_upd_admin", make_admin=True, db_session=db_session
    )

    create_resp = await client.post(
        "/ingredients",
        json={"name": "UserIngrForAdmin", **_BASE},
        headers=auth_headers(token_user),
    )
    ing_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/admin/ingredients/{ing_id}",
        json={"name": "AdminUpdatedIngr", "kcal": 999.0},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "AdminUpdatedIngr"
    assert resp.json()["kcal"] == 999.0


@pytest.mark.asyncio
async def test_admin_update_nonexistent_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "admin_upd_404", make_admin=True, db_session=db_session
    )
    resp = await client.patch(
        "/admin/ingredients/999999",
        json={"name": "Ghost"},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_delete_any_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    token_user = await register_and_login(client, "admin_del_user")
    token_admin = await register_and_login(
        client, "admin_del_admin", make_admin=True, db_session=db_session
    )

    create_resp = await client.post(
        "/ingredients",
        json={"name": "UserIngrForDel", **_BASE},
        headers=auth_headers(token_user),
    )
    ing_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/admin/ingredients/{ing_id}", headers=auth_headers(token_admin)
    )
    assert resp.status_code == 204

    # Confirm gone
    result = await db_session.execute(
        select(Ingredient).where(Ingredient.id == ing_id)
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_admin_delete_nonexistent_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "admin_del_404", make_admin=True, db_session=db_session
    )
    resp = await client.delete(
        "/admin/ingredients/999999", headers=auth_headers(token_admin)
    )
    assert resp.status_code == 404


# ===========================================================================
# Bulk import
# ===========================================================================

_BULK_ITEMS = [
    {
        "name": "Bulk Oats",
        "unit": "g",
        "portion_size": 100.0,
        "kcal": 370.0,
        "protein": 13.0,
        "fat": 7.0,
        "carbohydrates": 58.0,
        "fiber": 10.0,
        "sodium": 0.01,
    },
    {
        "name": "Bulk Rice",
        "unit": "g",
        "portion_size": 100.0,
        "kcal": 360.0,
        "protein": 7.0,
        "fat": 1.0,
        "carbohydrates": 77.0,
        "fiber": 2.0,
        "sodium": 0.002,
    },
]


@pytest.mark.asyncio
async def test_bulk_import_creates_system_ingredients(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "bulk_create_admin", make_admin=True, db_session=db_session
    )

    resp = await client.post(
        "/admin/ingredients/bulk-import",
        json=_BULK_ITEMS,
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["inserted"] == 2
    assert data["updated"] == 0

    # Confirm in DB and is_system
    result = await db_session.execute(
        select(Ingredient).where(Ingredient.name == "Bulk Oats")
    )
    oats = result.scalar_one_or_none()
    assert oats is not None
    assert oats.is_system is True
    assert oats.owner_id is None


@pytest.mark.asyncio
async def test_bulk_import_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "bulk_idem_admin", make_admin=True, db_session=db_session
    )

    # First import
    resp1 = await client.post(
        "/admin/ingredients/bulk-import",
        json=_BULK_ITEMS,
        headers=auth_headers(token_admin),
    )
    assert resp1.json()["inserted"] == 2
    assert resp1.json()["updated"] == 0

    # Second import — no new rows
    resp2 = await client.post(
        "/admin/ingredients/bulk-import",
        json=_BULK_ITEMS,
        headers=auth_headers(token_admin),
    )
    assert resp2.json()["inserted"] == 0
    assert resp2.json()["updated"] == 2


@pytest.mark.asyncio
async def test_bulk_import_invalid_unit_returns_422(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "bulk_unit_admin", make_admin=True, db_session=db_session
    )
    resp = await client.post(
        "/admin/ingredients/bulk-import",
        json=[{**_BULK_ITEMS[0], "unit": "invalid_unit"}],
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 422


# ===========================================================================
# User management
# ===========================================================================


@pytest.mark.asyncio
async def test_admin_list_users(client: AsyncClient, db_session: AsyncSession):
    token_admin = await register_and_login(
        client, "list_users_admin", make_admin=True, db_session=db_session
    )
    await register_and_login(client, "list_users_alice")
    await register_and_login(client, "list_users_bob")

    resp = await client.get("/admin/users", headers=auth_headers(token_admin))
    assert resp.status_code == 200
    usernames = [u["username"] for u in resp.json()]
    assert "list_users_alice" in usernames
    assert "list_users_bob" in usernames


@pytest.mark.asyncio
async def test_admin_deactivate_user(client: AsyncClient, db_session: AsyncSession):
    token_admin = await register_and_login(
        client, "deact_admin", make_admin=True, db_session=db_session
    )
    await register_and_login(client, "deact_target")

    # Get user id
    result = await db_session.execute(
        select(User).where(User.username == "deact_target")
    )
    user = result.scalar_one()

    resp = await client.patch(
        f"/admin/users/{user.id}",
        json={"is_active": False},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


@pytest.mark.asyncio
async def test_deactivated_user_cannot_login(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "deact_login_admin", make_admin=True, db_session=db_session
    )
    await register_and_login(client, "deact_login_target", password="s3cr3t!1")

    # Get user id and deactivate
    result = await db_session.execute(
        select(User).where(User.username == "deact_login_target")
    )
    user = result.scalar_one()

    await client.patch(
        f"/admin/users/{user.id}",
        json={"is_active": False},
        headers=auth_headers(token_admin),
    )

    # Try to login — should fail with 403
    resp = await client.post(
        "/auth/login",
        json={"username": "deact_login_target", "password": "s3cr3t!1"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_promote_user_to_admin(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "role_admin", make_admin=True, db_session=db_session
    )
    await register_and_login(client, "role_target")

    result = await db_session.execute(
        select(User).where(User.username == "role_target")
    )
    user = result.scalar_one()

    resp = await client.patch(
        f"/admin/users/{user.id}/role",
        json={"role": "admin"},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_admin_demote_admin_to_user(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "demote_admin", make_admin=True, db_session=db_session
    )
    await register_and_login(
        client, "demote_target", make_admin=True, db_session=db_session
    )

    result = await db_session.execute(
        select(User).where(User.username == "demote_target")
    )
    user = result.scalar_one()

    resp = await client.patch(
        f"/admin/users/{user.id}/role",
        json={"role": "user"},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "user"


@pytest.mark.asyncio
async def test_admin_user_update_nonexistent_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "usr_404_admin", make_admin=True, db_session=db_session
    )
    resp = await client.patch(
        "/admin/users/999999",
        json={"is_active": False},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_user_role_nonexistent_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    token_admin = await register_and_login(
        client, "role_404_admin", make_admin=True, db_session=db_session
    )
    resp = await client.patch(
        "/admin/users/999999/role",
        json={"role": "admin"},
        headers=auth_headers(token_admin),
    )
    assert resp.status_code == 404
