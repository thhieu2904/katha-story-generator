"""Cloudflare R2 storage client using boto3 S3-compatible API."""

from __future__ import annotations

import logging
from io import BytesIO
from urllib.parse import quote, unquote, urlsplit

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from katha.core.config import (
    IMAGE_R2_MIN_SOCKET_TIMEOUT_SECONDS,
    IMAGE_R2_RUNNER_UPLOAD_ATTEMPTS,
    Settings,
)

logger = logging.getLogger(__name__)

_ALLOWED_REFERENCE_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
_IMMUTABLE_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"
_R2_MAX_CONNECT_TIMEOUT_SECONDS = 5.0
_R2_MAX_READ_TIMEOUT_SECONDS = 30.0


class R2StorageError(RuntimeError):
    """Raised when an R2 storage operation cannot complete safely."""


class R2ReferenceError(R2StorageError):
    """Raised when a configured public reference cannot be loaded safely."""


class R2Client:
    """Client for Cloudflare R2 object storage."""

    def __init__(self, settings: Settings):
        self._bucket = settings.R2_BUCKET_NAME
        self._public_url = settings.R2_PUBLIC_URL.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL or None,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY or None,
            region_name="auto",
            config=_r2_transport_config(settings),
        )

    def check_connection(self) -> bool:
        """Check R2 connectivity via head_bucket. Returns True/False, never raises."""
        try:
            self._client.head_bucket(Bucket=self._bucket)
            return True
        except ClientError:
            logger.warning("R2 head_bucket check failed", exc_info=True)
            return False
        except Exception:
            logger.warning("R2 connection check failed unexpectedly", exc_info=True)
            return False

    def object_exists(self, key: str) -> bool:
        """Check if an object exists in the bucket."""
        try:
            self._client.head_object(Bucket=self._bucket, Key=self._validate_object_key(key))
            return True
        except ClientError:
            return False

    def upload_file(self, key: str, data: bytes, content_type: str = "image/png") -> str:
        """Upload a file to R2 and return its public URL.

        This existing generic upload path intentionally keeps its caller-provided
        content type. Phase 4 image assets should use :meth:`upload_image`.
        """
        safe_key = self._validate_object_key(key)
        self._client.upload_fileobj(
            Fileobj=BytesIO(data),
            Bucket=self._bucket,
            Key=safe_key,
            ExtraArgs={"ContentType": content_type},
        )
        return self.get_public_url(safe_key)

    def upload_image(self, key: str, data: bytes) -> str:
        """Upload an immutable WebP image and return its public URL."""
        safe_key = self._validate_object_key(key)
        if not data:
            raise R2StorageError("Cannot upload an empty image")

        try:
            # Image output is already bounded in memory. put_object keeps this Phase 4 path to
            # one botocore request, so the explicit Config timeout bounds the worker thread.
            self._client.put_object(
                Bucket=self._bucket,
                Key=safe_key,
                Body=data,
                ContentType="image/webp",
                CacheControl=_IMMUTABLE_IMAGE_CACHE_CONTROL,
            )
        except (BotoCoreError, ClientError) as exc:
            logger.warning("R2 image upload failed", extra={"key": safe_key})
            raise R2StorageError("R2 image upload failed") from exc
        return self.get_public_url(safe_key)

    def delete_object(self, key: str) -> None:
        """Delete one known object key; callers may treat failure as best effort."""
        safe_key = self._validate_object_key(key)
        try:
            self._client.delete_object(Bucket=self._bucket, Key=safe_key)
        except (BotoCoreError, ClientError) as exc:
            logger.warning("R2 object deletion failed", extra={"key": safe_key})
            raise R2StorageError("R2 object deletion failed") from exc

    def get_public_url(self, key: str) -> str:
        """Build a configured public URL for a validated object key."""
        safe_key = self._validate_object_key(key)
        if not self._public_url:
            raise R2StorageError("R2_PUBLIC_URL is required for public object URLs")
        return f"{self._public_url}/{quote(safe_key, safe='/')}"

    def key_from_public_url(self, url: str) -> str | None:
        """Return a safe bucket key only when *url* is under the configured base."""
        if not self._public_url:
            return None

        try:
            public_base = urlsplit(self._public_url)
            candidate = urlsplit(url)
        except (TypeError, ValueError):
            return None

        if (
            candidate.scheme.lower() != public_base.scheme.lower()
            or candidate.netloc.lower() != public_base.netloc.lower()
            or candidate.query
            or candidate.fragment
        ):
            return None

        base_path = public_base.path.rstrip("/")
        prefix = f"{base_path}/" if base_path else "/"
        if not candidate.path.startswith(prefix):
            return None

        try:
            return self._validate_object_key(unquote(candidate.path[len(prefix) :]))
        except R2StorageError:
            return None

    def download_public_reference(self, url: str, max_bytes: int) -> bytes:
        """Download a small supported image from this R2 public URL namespace.

        The URL is converted back to a validated bucket key and fetched through
        the authenticated client, so the method never performs an arbitrary
        HTTP request.
        """
        if max_bytes <= 0:
            raise R2ReferenceError("Reference byte limit must be positive")

        key = self.key_from_public_url(url)
        if key is None:
            raise R2ReferenceError("Reference URL is outside the configured R2 public URL")

        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
        except (BotoCoreError, ClientError) as exc:
            logger.warning("R2 reference download failed", extra={"key": key})
            raise R2ReferenceError("Reference image is unavailable") from exc

        body = response.get("Body")
        try:
            content_type = str(response.get("ContentType") or "").split(";", 1)[0].lower()
            if content_type not in _ALLOWED_REFERENCE_CONTENT_TYPES:
                raise R2ReferenceError("Reference image has an unsupported content type")

            content_length = response.get("ContentLength")
            if isinstance(content_length, int) and content_length > max_bytes:
                raise R2ReferenceError("Reference image exceeds the byte limit")

            read = getattr(body, "read", None)
            if not callable(read):
                raise R2ReferenceError("Reference image response has no readable body")
            data = read(max_bytes + 1)
            if not isinstance(data, bytes):
                raise R2ReferenceError("Reference image response was not bytes")
            if len(data) > max_bytes:
                raise R2ReferenceError("Reference image exceeds the byte limit")
            return data
        finally:
            close = getattr(body, "close", None)
            if callable(close):
                try:
                    close()
                except Exception:
                    logger.warning("R2 reference response close failed", extra={"key": key})

    @staticmethod
    def _validate_object_key(key: str) -> str:
        """Reject path traversal and ambiguous keys before calling S3."""
        decoded_key = unquote(key)
        if not decoded_key or decoded_key != decoded_key.strip():
            raise R2StorageError("R2 object key must not be blank or padded")
        if "\\" in decoded_key or "\x00" in decoded_key:
            raise R2StorageError("R2 object key contains an unsafe character")

        parts = decoded_key.split("/")
        if any(part in {"", ".", ".."} for part in parts):
            raise R2StorageError("R2 object key contains an unsafe path component")
        if any(ord(character) < 32 for character in decoded_key):
            raise R2StorageError("R2 object key contains a control character")
        return decoded_key


def _r2_transport_config(settings: Settings) -> Config:
    """Bound one R2 call so runner-owned retries fit the configured page deadline.

    The runner owns the single retry for an immutable upload key. Explicitly disabling
    botocore's implicit retries prevents a nested retry tree whose duration is invisible
    to the page deadline. The two runner attempts fit inside the portion of the page
    budget left after every configured OpenAI image attempt and a small page-finalization
    safety margin.
    """

    per_upload_attempt = (
        settings.image_r2_transport_budget_seconds / IMAGE_R2_RUNNER_UPLOAD_ATTEMPTS
    )
    connect_timeout = min(
        _R2_MAX_CONNECT_TIMEOUT_SECONDS,
        max(IMAGE_R2_MIN_SOCKET_TIMEOUT_SECONDS, per_upload_attempt / 4),
    )
    read_timeout = min(
        _R2_MAX_READ_TIMEOUT_SECONDS,
        max(IMAGE_R2_MIN_SOCKET_TIMEOUT_SECONDS, per_upload_attempt - connect_timeout),
    )
    return Config(
        connect_timeout=connect_timeout,
        read_timeout=read_timeout,
        retries={"mode": "standard", "total_max_attempts": 1},
    )
