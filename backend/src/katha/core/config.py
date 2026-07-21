"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings

_IMAGE_MAX_EDGE = 3840
_IMAGE_MAX_ASPECT_RATIO = 3
_IMAGE_MIN_PIXELS = 655_360
_IMAGE_MAX_PIXELS = 8_294_400
_IMAGE_STALE_SAFETY_MARGIN_SECONDS = 30
_IMAGE_MAX_OUTPUT_BYTES_HARD_CAP = 100 * 1024 * 1024
_IMAGE_R2_PAGE_BUDGET_MARGIN_SECONDS = 5.0
IMAGE_R2_MIN_SOCKET_TIMEOUT_SECONDS = 0.25
IMAGE_R2_RUNNER_UPLOAD_ATTEMPTS = 2
IMAGE_R2_MIN_TRANSPORT_BUDGET_SECONDS = (
    2 * IMAGE_R2_MIN_SOCKET_TIMEOUT_SECONDS * IMAGE_R2_RUNNER_UPLOAD_ATTEMPTS
)


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

    # Phase 4
    OPENAI_IMAGE_MODEL: str = "gpt-image-2"
    OPENAI_IMAGE_SIZE: str = "1536x864"
    OPENAI_IMAGE_QUALITY: str = "high"
    OPENAI_IMAGE_OUTPUT_FORMAT: str = "webp"
    OPENAI_IMAGE_OUTPUT_COMPRESSION: int = 90
    OPENAI_IMAGE_TIMEOUT_SECONDS: float = 150
    OPENAI_IMAGE_MAX_RETRIES: int = 1
    IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS: float = 180
    IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS: float = 330
    IMAGE_GENERATION_STALE_SECONDS: int = 900
    IMAGE_MAX_CONCURRENT_JOBS: int = 1
    IMAGE_MAX_OUTPUT_BYTES: int = 20 * 1024 * 1024

    @property
    def image_provider_retry_budget_seconds(self) -> float:
        """Maximum provider phase budget including the SDK-owned retry."""

        return self.OPENAI_IMAGE_TIMEOUT_SECONDS * (self.OPENAI_IMAGE_MAX_RETRIES + 1)

    @property
    def image_r2_transport_budget_seconds(self) -> float:
        """Transport time available for both runner-owned R2 upload attempts."""

        return (
            self.IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS
            - self.image_provider_retry_budget_seconds
            - _IMAGE_R2_PAGE_BUDGET_MARGIN_SECONDS
        )

    @model_validator(mode="after")
    def validate_text_timeouts(self) -> "Settings":
        if self.TEXT_GENERATION_STALE_SECONDS <= self.TEXT_OPERATION_TIMEOUT_SECONDS:
            raise ValueError(
                "TEXT_GENERATION_STALE_SECONDS must exceed TEXT_OPERATION_TIMEOUT_SECONDS"
            )
        return self

    @model_validator(mode="after")
    def validate_image_generation_settings(self) -> "Settings":
        self.OPENAI_IMAGE_MODEL = self.OPENAI_IMAGE_MODEL.strip()
        if not self.OPENAI_IMAGE_MODEL:
            raise ValueError("OPENAI_IMAGE_MODEL must not be blank")

        size_parts = self.OPENAI_IMAGE_SIZE.lower().strip().split("x")
        if len(size_parts) != 2 or not all(part.isdecimal() for part in size_parts):
            raise ValueError("OPENAI_IMAGE_SIZE must use WIDTHxHEIGHT integer dimensions")
        width, height = (int(part) for part in size_parts)
        if width <= 0 or height <= 0:
            raise ValueError("OPENAI_IMAGE_SIZE dimensions must be positive")
        if width % 16 != 0 or height % 16 != 0:
            raise ValueError("OPENAI_IMAGE_SIZE dimensions must be multiples of 16")
        if max(width, height) > _IMAGE_MAX_EDGE:
            raise ValueError(f"OPENAI_IMAGE_SIZE edges must be <= {_IMAGE_MAX_EDGE}")
        if max(width, height) / min(width, height) > _IMAGE_MAX_ASPECT_RATIO:
            raise ValueError(
                f"OPENAI_IMAGE_SIZE aspect ratio must not exceed {_IMAGE_MAX_ASPECT_RATIO}:1"
            )
        pixel_count = width * height
        if not _IMAGE_MIN_PIXELS <= pixel_count <= _IMAGE_MAX_PIXELS:
            raise ValueError(
                "OPENAI_IMAGE_SIZE pixel count must be between "
                f"{_IMAGE_MIN_PIXELS} and {_IMAGE_MAX_PIXELS}"
            )
        self.OPENAI_IMAGE_SIZE = f"{width}x{height}"

        self.OPENAI_IMAGE_QUALITY = self.OPENAI_IMAGE_QUALITY.strip().lower()
        if self.OPENAI_IMAGE_QUALITY not in {"low", "medium", "high"}:
            raise ValueError("OPENAI_IMAGE_QUALITY must be low, medium, or high")

        self.OPENAI_IMAGE_OUTPUT_FORMAT = self.OPENAI_IMAGE_OUTPUT_FORMAT.strip().lower()
        if self.OPENAI_IMAGE_OUTPUT_FORMAT != "webp":
            raise ValueError("OPENAI_IMAGE_OUTPUT_FORMAT must be webp for Phase 4")

        if not 0 <= self.OPENAI_IMAGE_OUTPUT_COMPRESSION <= 100:
            raise ValueError("OPENAI_IMAGE_OUTPUT_COMPRESSION must be between 0 and 100")
        if self.OPENAI_IMAGE_MAX_RETRIES not in {0, 1}:
            raise ValueError("OPENAI_IMAGE_MAX_RETRIES must be 0 or 1")
        if self.OPENAI_IMAGE_TIMEOUT_SECONDS <= 0:
            raise ValueError("OPENAI_IMAGE_TIMEOUT_SECONDS must be positive")
        if self.IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS <= self.OPENAI_IMAGE_TIMEOUT_SECONDS:
            raise ValueError(
                "IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS must exceed OPENAI_IMAGE_TIMEOUT_SECONDS"
            )
        if self.image_r2_transport_budget_seconds < IMAGE_R2_MIN_TRANSPORT_BUDGET_SECONDS:
            raise ValueError(
                "IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS must exceed the complete OpenAI image "
                "retry budget plus the R2 safety margin and minimum R2 transport budget"
            )
        if self.IMAGE_GENERATION_STALE_SECONDS <= (
            self.IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS + _IMAGE_STALE_SAFETY_MARGIN_SECONDS
        ):
            raise ValueError(
                "IMAGE_GENERATION_STALE_SECONDS must exceed IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS "
                "plus the safety margin"
            )
        if self.IMAGE_MAX_CONCURRENT_JOBS < 1:
            raise ValueError("IMAGE_MAX_CONCURRENT_JOBS must be at least 1")
        if not 0 < self.IMAGE_MAX_OUTPUT_BYTES <= _IMAGE_MAX_OUTPUT_BYTES_HARD_CAP:
            raise ValueError(
                "IMAGE_MAX_OUTPUT_BYTES must be positive and no greater than "
                f"{_IMAGE_MAX_OUTPUT_BYTES_HARD_CAP}"
            )
        return self

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Load application settings once per process."""

    return Settings()
