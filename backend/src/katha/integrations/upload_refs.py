"""Upload character reference images to R2 and update DB.

Usage: python -m katha.integrations.upload_refs

Idempotent — checks if object exists on R2 before uploading.
Updates characters.ref_image_urls in DB after upload.
"""

import asyncio
import logging
from pathlib import Path

from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from katha.core.config import Settings
from katha.features.characters.models import Character
from katha.integrations.r2_storage import R2Client

logger = logging.getLogger(__name__)

# Mapping: character name → ref image filename
REF_IMAGES = {
    "Srey": "01-srey.png",
    "Dara": "02-dara.png",
    "Yeay": "03-yeay.png",
    "Mae": "04-mae.png",
    "Bopha": "05-bopha.png",
    "Lok Kru": "06-lok-kru.png",
    "Meas": "07-meas.png",
}

REFS_DIR = Path(__file__).resolve().parents[4] / "plan" / "characters" / "refs"


async def upload_refs(
    refs_dir: Path | None = None, database_url: str | None = None
) -> dict[str, str]:
    """Upload reference images to R2, update DB. Returns {name: url}."""
    settings = Settings()
    if database_url is None:
        database_url = settings.DATABASE_URL
    if refs_dir is None:
        refs_dir = REFS_DIR

    r2 = R2Client(settings)
    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    results: dict[str, str] = {}

    for char_name, filename in REF_IMAGES.items():
        filepath = refs_dir / filename
        r2_key = f"characters/refs/{filename}"

        if not filepath.exists():
            logger.warning("Ref image not found: %s", filepath)
            continue

        # Check if already uploaded (idempotent)
        if r2.object_exists(r2_key):
            logger.info("Already on R2: %s", r2_key)
        else:
            with open(filepath, "rb") as f:
                r2.upload_file(r2_key, f.read(), "image/png")
            logger.info("Uploaded: %s", r2_key)

        public_url = r2.get_public_url(r2_key)
        results[char_name] = public_url

        # Update character ref_image_urls in DB
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    update(Character)
                    .where(Character.name == char_name)
                    .values(ref_image_urls=[public_url])
                )

    await engine.dispose()
    return results


async def main():
    logging.basicConfig(level=logging.INFO)
    results = await upload_refs()
    print(f"\nUploaded {len(results)} reference images:")
    for name, url in results.items():
        print(f"  {name}: {url}")


if __name__ == "__main__":
    asyncio.run(main())
