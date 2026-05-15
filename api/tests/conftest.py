"""
Shared pytest fixtures.

Uses SQLite in-memory as the test database — no running Postgres required.
StaticPool ensures all sessions share the same in-memory database instance.
Settings are injected via app.dependency_overrides; no environment variables
are needed for tests to run.
"""

import asyncio
import os
from collections.abc import AsyncGenerator

# ---------------------------------------------------------------------------
# Set required env vars BEFORE any app module is imported.
# app/main.py calls get_settings() at module level (to configure middleware),
# so the env vars must exist at import time.  These values are only used for
# the Settings object that wires up the CORS middleware; all DB / auth
# behaviour is overridden below via app.dependency_overrides.
# ---------------------------------------------------------------------------
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")


import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.limiter import limiter
from app.main import app

# ---------------------------------------------------------------------------
# Hardcoded test settings — no env vars, no real DB
# ---------------------------------------------------------------------------

TEST_SETTINGS = Settings(
    DATABASE_URL="sqlite+aiosqlite:///:memory:",
    SECRET_KEY="test-secret-key-not-for-production",
    BCRYPT_ROUNDS=4,
)


def get_test_settings() -> Settings:
    return TEST_SETTINGS


# ---------------------------------------------------------------------------
# In-memory SQLite engine shared across the whole test session
# StaticPool: all connections reuse the same in-memory DB instance
# ---------------------------------------------------------------------------

_test_engine = create_async_engine(
    TEST_SETTINGS.DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSessionLocal = async_sessionmaker(_test_engine, expire_on_commit=False)


async def _test_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _TestSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Session-scoped: create all tables once
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
            await conn.execute(text(f"DELETE FROM {table}"))
    limiter._storage.reset()


# ---------------------------------------------------------------------------
# HTTP client wired to test settings + in-memory DB
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
