"""
Shared pytest fixtures.

Strategy:
- The HTTP client's requests each get their own fresh session from the test DB
  (standard get_db behaviour, but pointed at calorietracker_test).
- A session-scoped fixture creates and drops all tables once per run.
- A function-scoped fixture truncates all user-data tables after each test so
  tests are independent without needing to share sessions.
- Tests that need direct DB access (e.g. to deactivate a user) get a separate
  session via the `db_session` fixture — it is NOT the same session the HTTP
  handler uses.
"""
import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from sqlalchemy.pool import NullPool

from app.config import settings
from app.database import Base, get_db
from app.limiter import limiter
from app.main import app

# ---------------------------------------------------------------------------
# Test engine / session factory — points at calorietracker_test
# ---------------------------------------------------------------------------

TEST_DB_URL = settings.TEST_DATABASE_URL

_test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
_TestSessionLocal = async_sessionmaker(_test_engine, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Session-scoped: create all tables once, drop at the end
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_test_tables():
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _test_engine.dispose()


# ---------------------------------------------------------------------------
# Function-scoped: truncate tables after every test
# ---------------------------------------------------------------------------

_TRUNCATE_TABLES = ["refresh_tokens", "users"]


@pytest_asyncio.fixture(autouse=True)
async def truncate_tables():
    """Clean up data rows between tests (keeps schema intact)."""
    # Reset rate limiter BEFORE each test so counters from previous tests don't bleed in
    limiter._storage.reset()
    yield
    async with _test_engine.begin() as conn:
        for table in _TRUNCATE_TABLES:
            await conn.execute(text(f"TRUNCATE {table} CASCADE"))
    limiter._storage.reset()


# ---------------------------------------------------------------------------
# HTTP client — wired to test DB but uses its own per-request sessions
# ---------------------------------------------------------------------------


async def _test_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Drop-in replacement for get_db that uses the test DB."""
    async with _TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_db] = _test_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Direct DB access for tests that need to inspect / mutate the DB directly
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """A separate session for direct DB access in tests (not shared with the client)."""
    async with _TestSessionLocal() as session:
        yield session
