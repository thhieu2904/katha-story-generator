"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from .env file and environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:54322/postgres"

    # Supabase Auth
    SUPABASE_URL: str = ""
    SUPABASE_JWT_AUDIENCE: str = "authenticated"

    # R2 Storage
    R2_ENDPOINT_URL: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "katha-assets"
    R2_PUBLIC_URL: str = ""

    # App
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Phase 3
    OPENAI_API_KEY: str = ""
    OPENAI_TEXT_MODEL: str = "gpt-4o-mini"
    OPENAI_TIMEOUT_SECONDS: float = 60
    OPENAI_MAX_RETRIES: int = 1
    TEXT_OPERATION_TIMEOUT_SECONDS: float = 270
    TEXT_GENERATION_STALE_SECONDS: int = 600

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Load application settings once per process."""

    return Settings()
