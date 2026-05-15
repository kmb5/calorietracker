"""Tests for application startup and middleware wiring.

These tests exist to catch infrastructure regressions that endpoint-level
tests miss — specifically that middleware is correctly registered before the
app starts serving requests.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cors_preflight_returns_allow_origin_header(client: AsyncClient) -> None:
    """CORS middleware must be registered at module level, before the app starts.

    This test would silently pass if middleware is missing (preflight would
    just return 200 with no CORS headers), so we assert the header is
    *present*, not merely that the request succeeds.

    Regression: an earlier fix moved add_middleware() into the lifespan
    handler.  Starlette raises RuntimeError("Cannot add middleware after an
    application has started") in production because uvicorn builds the
    middleware stack when it dispatches the first lifespan scope — before
    the lifespan body runs.  httpx's ASGITransport never sends the lifespan
    scope, so the bug was invisible to the test suite.
    """
    resp = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" in resp.headers, (
        "CORSMiddleware is not registered — add_middleware() must be called "
        "at module level, not inside the lifespan handler."
    )
    assert resp.headers["access-control-allow-origin"] == "http://localhost:5173"


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    """Sanity-check that the app starts and the health endpoint responds."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
