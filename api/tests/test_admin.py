"""Tests for /admin/* endpoints — promotions, system ingredient CRUD, bulk import, user management."""

import pytest
from conftest import auth_headers, register_and_login
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# Shared ingredient payload helper
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


async def _make_admin_token(
    client: AsyncClient, db_session: AsyncSession, username: str = "admin_user"
) -> str:
    return await register_and_login(
        client, username, make_admin=True, db_session=db_session
    )


async def _make_user_token(client: AsyncClient, username: str = "plain_user") -> str:
    return await register_and_login(client, username)


# ---------------------------------------------------------------------------
# Auth / access guards (all admin routes must reject non-admin)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_promotions_list_requires_admin(client: AsyncClient):
    token = await _make_user_token(client)
    resp = await client.get(
        "/admin/ingredients/promotions", headers=auth_headers(token)
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_create_ingredient_requires_admin(client: AsyncClient):
    token = await _make_user_token(client, "non_admin_create")
    resp = await client.post(
        "/admin/ingredients",
        json={"name": "Hack", **_BASE},
        headers=auth_headers(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_bulk_import_requires_admin(client: AsyncClient):
    token = await _make_user_token(client, "non_admin_bulk")
    resp = await client.post(
        "/admin/ingredients/bulk-import", json=[], headers=auth_headers(token)
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_users_requires_admin(client: AsyncClient):
    token = await _make_user_token(client, "non_admin_users")
    resp = await client.get("/admin/users", headers=auth_headers(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_all_admin_routes_require_auth(client: AsyncClient):
    for method, path in [
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
    ]:
        resp = await client.request(method, path)
        assert resp.status_code == 401, f"{method} {path} should be 401 without auth"


# ---------------------------------------------------------------------------
# GET /admin/ingredients/promotions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_promotions_empty(client: AsyncClient, db_session: AsyncSession):
    token = await _make_admin_token(client, db_session)
    resp = await client.get(
        "/admin/ingredients/promotions", headers=auth_headers(token)
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_promotions_returns_only_pending(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session)
    user_token = await _make_user_token(client, "promoter")

    # Create a custom ingredient as a regular user
    resp = await client.post(
        "/ingredients",
        json={"name": "My Sauce", **_BASE},
        headers=auth_headers(user_token),
    )
    assert resp.status_code == 201
    ingredient_id = resp.json()["id"]

    # No promotions yet
    resp = await client.get(
        "/admin/ingredients/promotions", headers=auth_headers(admin_token)
    )
    assert resp.json() == []

    # Submit for promotion
    await client.post(
        f"/ingredients/{ingredient_id}/promote", headers=auth_headers(user_token)
    )

    resp = await client.get(
        "/admin/ingredients/promotions", headers=auth_headers(admin_token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == ingredient_id
    assert data[0]["is_promotion_pending"] is True


# ---------------------------------------------------------------------------
# POST /admin/ingredients/promotions/{id}/approve
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_approve_promotion(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session)
    user_token = await _make_user_token(client, "promoter2")

    resp = await client.post(
        "/ingredients",
        json={"name": "Apple Sauce", **_BASE},
        headers=auth_headers(user_token),
    )
    ingredient_id = resp.json()["id"]
    await client.post(
        f"/ingredients/{ingredient_id}/promote", headers=auth_headers(user_token)
    )

    resp = await client.post(
        f"/admin/ingredients/promotions/{ingredient_id}/approve",
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_system"] is True
    assert data["owner_id"] is None
    assert data["is_promotion_pending"] is False


@pytest.mark.asyncio
async def test_approve_non_pending_returns_400(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_app2")
    user_token = await _make_user_token(client, "user_app2")

    resp = await client.post(
        "/ingredients",
        json={"name": "Plain Ingredient", **_BASE},
        headers=auth_headers(user_token),
    )
    ingredient_id = resp.json()["id"]

    # Not pending — should 400
    resp = await client.post(
        f"/admin/ingredients/promotions/{ingredient_id}/approve",
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_approve_missing_ingredient_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_app3")
    resp = await client.post(
        "/admin/ingredients/promotions/99999/approve",
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /admin/ingredients/promotions/{id}/reject
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reject_promotion_stores_note(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_rej")
    user_token = await _make_user_token(client, "promoter_rej")

    resp = await client.post(
        "/ingredients",
        json={"name": "Rejected Sauce", **_BASE},
        headers=auth_headers(user_token),
    )
    ingredient_id = resp.json()["id"]
    await client.post(
        f"/ingredients/{ingredient_id}/promote", headers=auth_headers(user_token)
    )

    resp = await client.post(
        f"/admin/ingredients/promotions/{ingredient_id}/reject",
        json={"rejection_note": "Duplicate of existing system ingredient"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_promotion_pending"] is False
    assert data["is_system"] is False
    assert data["promotion_rejection_note"] == "Duplicate of existing system ingredient"


@pytest.mark.asyncio
async def test_reject_requires_note(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session, "admin_rej2")
    resp = await client.post(
        "/admin/ingredients/promotions/1/reject",
        json={},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /admin/ingredients — create system ingredient
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_create_system_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_create")
    resp = await client.post(
        "/admin/ingredients",
        json={"name": "System Oats", **_BASE},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_system"] is True
    assert data["owner_id"] is None
    assert data["name"] == "System Oats"


@pytest.mark.asyncio
async def test_admin_created_ingredient_visible_to_all_users(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_vis")
    user_token = await _make_user_token(client, "user_vis")

    await client.post(
        "/admin/ingredients",
        json={"name": "Visible Oats", **_BASE},
        headers=auth_headers(admin_token),
    )

    resp = await client.get(
        "/ingredients/search?q=Visible", headers=auth_headers(user_token)
    )
    assert resp.status_code == 200
    names = [i["name"] for i in resp.json()]
    assert "Visible Oats" in names


# ---------------------------------------------------------------------------
# PATCH /admin/ingredients/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_can_update_any_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_upd")
    user_token = await _make_user_token(client, "owner_upd")

    resp = await client.post(
        "/ingredients",
        json={"name": "User Tomato", **_BASE},
        headers=auth_headers(user_token),
    )
    ingredient_id = resp.json()["id"]

    resp = await client.patch(
        f"/admin/ingredients/{ingredient_id}",
        json={"name": "Admin-Renamed Tomato"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Admin-Renamed Tomato"


@pytest.mark.asyncio
async def test_admin_update_missing_ingredient_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_upd2")
    resp = await client.patch(
        "/admin/ingredients/99999",
        json={"name": "Ghost"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /admin/ingredients/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_can_delete_any_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_del")
    user_token = await _make_user_token(client, "owner_del")

    resp = await client.post(
        "/ingredients",
        json={"name": "Delete Me", **_BASE},
        headers=auth_headers(user_token),
    )
    ingredient_id = resp.json()["id"]

    resp = await client.delete(
        f"/admin/ingredients/{ingredient_id}", headers=auth_headers(admin_token)
    )
    assert resp.status_code == 204

    resp = await client.get(
        f"/ingredients/{ingredient_id}", headers=auth_headers(user_token)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_delete_missing_ingredient_returns_404(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_del2")
    resp = await client.delete(
        "/admin/ingredients/99999", headers=auth_headers(admin_token)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /admin/ingredients/bulk-import
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bulk_import_creates_ingredients(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_bulk")
    payload = [
        {"name": "Bulk Rice", **_BASE},
        {"name": "Bulk Pasta", **_BASE},
    ]
    resp = await client.post(
        "/admin/ingredients/bulk-import",
        json=payload,
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["created"] == 2
    assert data["updated"] == 0
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_bulk_import_is_idempotent(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session, "admin_bulk2")
    payload = [{"name": "Idempotent Grain", **_BASE}]

    resp1 = await client.post(
        "/admin/ingredients/bulk-import",
        json=payload,
        headers=auth_headers(admin_token),
    )
    assert resp1.json()["created"] == 1

    resp2 = await client.post(
        "/admin/ingredients/bulk-import",
        json=payload,
        headers=auth_headers(admin_token),
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["created"] == 0
    assert data2["updated"] == 1


@pytest.mark.asyncio
async def test_bulk_import_creates_system_ingredients(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_bulk3")
    user_token = await _make_user_token(client, "user_bulk3")

    await client.post(
        "/admin/ingredients/bulk-import",
        json=[{"name": "System Lentils", **_BASE}],
        headers=auth_headers(admin_token),
    )

    # Should be visible to other users
    resp = await client.get(
        "/ingredients/search?q=System+Lentils", headers=auth_headers(user_token)
    )
    assert resp.status_code == 200
    assert any(i["name"] == "System Lentils" for i in resp.json())


# ---------------------------------------------------------------------------
# GET /admin/users
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_users_returns_all(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session, "admin_list_users")
    await register_and_login(client, "user_a_list")
    await register_and_login(client, "user_b_list")

    resp = await client.get("/admin/users", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    usernames = [u["username"] for u in resp.json()]
    assert "admin_list_users" in usernames
    assert "user_a_list" in usernames
    assert "user_b_list" in usernames


# ---------------------------------------------------------------------------
# PATCH /admin/users/{id} — activate / deactivate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_deactivate_user_blocks_login(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_deact")
    await register_and_login(client, "victim")

    # Get victim's user id
    users_resp = await client.get("/admin/users", headers=auth_headers(admin_token))
    victim = next(u for u in users_resp.json() if u["username"] == "victim")
    victim_id = victim["id"]

    resp = await client.patch(
        f"/admin/users/{victim_id}",
        json={"is_active": False},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Deactivated user login attempt should fail with 403
    resp = await client.post(
        "/auth/login", json={"username": "victim", "password": "s3cr3t!1"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_activate_user(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session, "admin_act")
    await register_and_login(client, "toggled_user")

    users_resp = await client.get("/admin/users", headers=auth_headers(admin_token))
    toggled_id = next(
        u["id"] for u in users_resp.json() if u["username"] == "toggled_user"
    )

    # Deactivate
    resp = await client.patch(
        f"/admin/users/{toggled_id}",
        json={"is_active": False},
        headers=auth_headers(admin_token),
    )
    assert resp.json()["is_active"] is False

    # Re-activate
    resp = await client.patch(
        f"/admin/users/{toggled_id}",
        json={"is_active": True},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


@pytest.mark.asyncio
async def test_update_user_active_not_found(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_act2")
    resp = await client.patch(
        "/admin/users/99999",
        json={"is_active": False},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /admin/users/{id}/role
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_promote_user_to_admin(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session, "admin_role")
    await register_and_login(client, "future_admin")

    users_resp = await client.get("/admin/users", headers=auth_headers(admin_token))
    future_id = next(
        u["id"] for u in users_resp.json() if u["username"] == "future_admin"
    )

    resp = await client.patch(
        f"/admin/users/{future_id}/role",
        json={"role": "admin"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_demote_admin_to_user(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session, "admin_role2")
    await register_and_login(client, "ex_admin")

    users_resp = await client.get("/admin/users", headers=auth_headers(admin_token))
    ex_id = next(u["id"] for u in users_resp.json() if u["username"] == "ex_admin")

    # Promote then demote
    await client.patch(
        f"/admin/users/{ex_id}/role",
        json={"role": "admin"},
        headers=auth_headers(admin_token),
    )
    resp = await client.patch(
        f"/admin/users/{ex_id}/role",
        json={"role": "user"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "user"


@pytest.mark.asyncio
async def test_update_user_role_not_found(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_role3")
    resp = await client.patch(
        "/admin/users/99999/role",
        json={"role": "admin"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_user_role_invalid_value(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_role4")
    resp = await client.patch(
        "/admin/users/1/role",
        json={"role": "superuser"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Self-modification guards
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_cannot_deactivate_self(
    client: AsyncClient, db_session: AsyncSession
):
    admin_token = await _make_admin_token(client, db_session, "admin_self_deact")
    users_resp = await client.get("/admin/users", headers=auth_headers(admin_token))
    admin_id = next(
        u["id"] for u in users_resp.json() if u["username"] == "admin_self_deact"
    )
    resp = await client.patch(
        f"/admin/users/{admin_id}",
        json={"is_active": False},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_admin_cannot_demote_self(client: AsyncClient, db_session: AsyncSession):
    admin_token = await _make_admin_token(client, db_session, "admin_self_demote")
    users_resp = await client.get("/admin/users", headers=auth_headers(admin_token))
    admin_id = next(
        u["id"] for u in users_resp.json() if u["username"] == "admin_self_demote"
    )
    resp = await client.patch(
        f"/admin/users/{admin_id}/role",
        json={"role": "user"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_bulk_import_does_not_overwrite_user_ingredient(
    client: AsyncClient, db_session: AsyncSession
):
    """Bulk import must not silently strip owner_id from user-created ingredients."""
    admin_token = await _make_admin_token(client, db_session, "admin_bulk_guard")
    user_token = await _make_user_token(client, "user_bulk_guard")

    # User creates a custom ingredient with the same (name, unit) as the bulk payload
    create_resp = await client.post(
        "/ingredients",
        json={"name": "Shared Name", **_BASE},
        headers=auth_headers(user_token),
    )
    assert create_resp.status_code == 201
    user_ing_id = create_resp.json()["id"]

    # Bulk-import a system ingredient with the same (name, unit)
    import_resp = await client.post(
        "/admin/ingredients/bulk-import",
        json=[{"name": "Shared Name", **_BASE}],
        headers=auth_headers(admin_token),
    )
    assert import_resp.status_code == 200
    # Row is skipped, not created, because a user-owned ingredient occupies the key
    assert import_resp.json()["created"] == 0
    assert import_resp.json()["updated"] == 0

    # The original user ingredient must still be owned by the user
    ing_resp = await client.get(
        f"/ingredients/{user_ing_id}", headers=auth_headers(user_token)
    )
    assert ing_resp.status_code == 200
    data = ing_resp.json()
    assert data["is_system"] is False
    assert data["owner_id"] is not None
