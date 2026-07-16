"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from .env file and environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:54322/postgres"

    # Supabase (Phase 1: optional)
    SUPABASE_URL: str = ""

    # R2 Storage
    R2_ENDPOINT_URL: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "katha-assets"
    R2_PUBLIC_URL: str = ""

    # App
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Phase 2
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Phase 3
    OPENAI_API_KEY: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }
