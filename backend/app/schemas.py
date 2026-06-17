from pydantic import BaseModel, Field, field_validator
import re


class ExtractionRequest(BaseModel):
    youtube_url: str
    transcript: str | None = None  # Optional client-provided transcript


class Recommendation(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=5)
    stock_name: str = Field("", max_length=100)
    sentiment: int = Field(..., ge=-2, le=2)
    target_price: float | None = None
    conviction_level: int = Field(..., ge=1, le=10)
    catalyst_notes: str = Field(..., min_length=1, max_length=500)

    @field_validator("ticker", mode="before")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        """Post-process LLM output: uppercase, strip whitespace, replace periods with hyphens."""
        v = v.strip()
        v = v.upper()
        v = re.sub(r"\s+", "", v)
        v = v.replace(".", "-")
        return v


class LLMResponse(BaseModel):
    video_summary: str = Field("", max_length=350)
    recommendations: list[Recommendation]


class ExtractionResponse(BaseModel):
    status: str = "success"
    channel_name: str
    video_id: str
    published_at: str
    tickers_extracted: list[str]
    recommendation_count: int


class ParsedURL(BaseModel):
    video_id: str
    canonical_url: str


class VideoMetadata(BaseModel):
    channel_name: str
    published_at: str  # ISO 8601
