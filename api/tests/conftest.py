"""
Shared pytest fixtures.

No environment variables are required — test settings are injected via
app.dependency_overrides[get_settings].  The test DB engine uses NullPool
so asyncpg connections are never reused across pytest-asyncio's
function-scoped event loops.
"""
import asyncio
import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.limiter import limiter
from app.main import app

# ---------------------------------------------------------------------------
# Hardcoded test settings — DATABASE_URL defaults to localhost but can be
# overridden via TEST_DATABASE_URL for Docker / CI environments.
# SECRET_KEY is always a fixed test value; no real secret needed.
# ---------------------------------------------------------------------------

_TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://calorietracker:secret@localhost:5432/calorietracker_test",
)

_TEST_SETTINGS = Settings(
    DATABASE_URL=_TEST_DB_URL,
    SECRET_KEY="test-secret-key-not-for-production",
)


def get_test_settings() -> Settings:
    return _TEST_SETTINGS


# ---------------------------------------------------------------------------
# Test DB engine (NullPool avoids cross-loop connection reuse)
# ---------------------------------------------------------------------------

_test_engine = create_async_engine(_TEST_SETTINGS.DATABASE_URL, poolclass=NullPool)
_TestSessionLocal = async_sessionmaker(_test_engine, expire_on_commit=False)


async def _test_get_db() -> AsyncGenerator[AsyncSession, None]:
    """get_db override: uses the test DB with NullPool."""
    async with _TestSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Session-scoped: create all tables once, drop at the end
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def event_loop():
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
# Function-scoped: truncate tables + reset rate limiter between tests
# ---------------------------------------------------------------------------

_TRUNCATE_TABLES = ["refresh_tokens", "users"]


@pytest_asyncio.fixture(autouse=True)
async def clean_between_tests():
    limiter._storage.reset()
    yield
    async with _test_engine.begin() as conn:
        for table in _TRUNCATE_TABLES:
            await conn.execute(text(f"TRUNCATE {table} CASCADE"))
    limiter._storage.reset()


# ---------------------------------------------------------------------------
# HTTP client wired to test settings + test DB
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_settings] = get_test_settings
    app.dependency_overrides[get_db] = _test_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Direct DB session for tests that need to inspect / mutate the DB directly
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with _TestSessionLocal() as session:
        yield session
