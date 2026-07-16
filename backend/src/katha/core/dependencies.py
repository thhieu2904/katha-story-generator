"""FastAPI dependency injection providers."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.database import get_async_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Depends: yields an async database session."""
    async for session in get_async_session():
        yield session
