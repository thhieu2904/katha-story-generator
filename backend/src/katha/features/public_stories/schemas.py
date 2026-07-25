from pydantic import BaseModel


class PublicPageResponse(BaseModel):
    page_no: int
    text_km: str
    text_vi: str
    image_url: str | None


class PublicCoverResponse(BaseModel):
    background_url: str | None  # image_url of page 1, or None


class PublicStoryResponse(BaseModel):
    title_km: str | None
    title_vi: str | None
    target_age: str | None
    page_count: int
    cover: PublicCoverResponse
    pages: list[PublicPageResponse]
