from collections.abc import AsyncGenerator
from functools import lru_cache

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import Settings, get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def _get_engine(database_url: str, echo: bool):
    """Return a cached engine for the given URL.  One engine per URL across the process lifetime."""
    return create_async_engine(database_url, echo=echo)


async def get_db(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[AsyncSession, None]:
    engine = _get_engine(settings.DATABASE_URL, settings.ENVIRONMENT == "development")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
