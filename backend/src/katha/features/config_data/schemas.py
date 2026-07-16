"""Public response schemas for configuration data."""

from pydantic import BaseModel, ConfigDict


class BackboneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_vi: str
    name_en: str
    description_vi: str | None


class GenreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_vi: str
    name_en: str
    description_vi: str | None


class ArtStyleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_vi: str
    name_en: str
    sample_image_url: str | None
