"""Cloudflare R2 storage client using boto3 S3-compatible API."""

import logging
from io import BytesIO

import boto3
from botocore.exceptions import ClientError

from katha.core.config import Settings

logger = logging.getLogger(__name__)


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
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False

    def upload_file(self, key: str, data: bytes, content_type: str = "image/png") -> str:
        """Upload a file to R2 and return its public URL.

        Args:
            key: Object key / path in the bucket.
            data: Raw file bytes.
            content_type: MIME type of the file.

        Returns:
            Public URL string for the uploaded object.
        """
        self._client.upload_fileobj(
            Fileobj=BytesIO(data),
            Bucket=self._bucket,
            Key=key,
            ExtraArgs={"ContentType": content_type},
        )
        return self.get_public_url(key)

    def get_public_url(self, key: str) -> str:
        """Build the public URL for an object key."""
        return f"{self._public_url}/{key}"
