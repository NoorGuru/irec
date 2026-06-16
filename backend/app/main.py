"""YTPortfolio API - FastAPI application for YouTube stock recommendation extraction."""

import logging
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.auth import verify_owner
from app.database import check_duplicate, persist_extraction
from app.llm_parser import parse_recommendations
from app.metadata import fetch_metadata
from app.schemas import ExtractionRequest, ExtractionResponse
from app.transcript import fetch_transcript
from app.url_parser import parse_url

logger = logging.getLogger(__name__)

app = FastAPI(title="YTPortfolio API")

# CORS configuration from environment variable (comma-separated list of origins)
_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
origins = [origin.strip() for origin in _cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _log_pipeline_error(
    youtube_url: str, pipeline_stage: str, error: Exception
) -> None:
    """Log structured error information for a pipeline stage failure.

    Logs youtube_url, pipeline_stage, timestamp, and error_details as
    required by Requirement 11.6.
    """
    logger.error(
        "Pipeline error",
        extra={
            "youtube_url": youtube_url,
            "pipeline_stage": pipeline_stage,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error_details": str(error),
        },
    )


@app.get("/api/v1/debug-auth")
async def debug_auth(
    _owner: str = Depends(verify_owner),
):
    """Temporary debug endpoint to test auth in isolation."""
    return {"status": "ok", "email": _owner}


@app.post(
    "/api/v1/extract",
    response_model=ExtractionResponse,
    status_code=201,
)
async def extract(
    request: ExtractionRequest,
    _owner: str = Depends(verify_owner),
) -> ExtractionResponse:
    """Extract stock recommendations from a YouTube video.

    Orchestrates the full pipeline: URL parse → duplicate check → metadata →
    transcript → LLM parse → database persistence.

    No timeout shorter than 120 seconds is imposed on request processing
    (Requirement 5.5).
    """
    youtube_url = request.youtube_url

    # Step 1: Parse URL → get video_id and canonical_url
    try:
        parsed = parse_url(youtube_url)
    except HTTPException as e:
        _log_pipeline_error(youtube_url, "url_parsing", e)
        raise
    except Exception as e:
        _log_pipeline_error(youtube_url, "url_parsing", e)
        raise HTTPException(status_code=400, detail="URL format not recognized")

    # Step 2: Check duplicate → raise 409 if exists
    try:
        is_duplicate = await check_duplicate(parsed.video_id)
    except HTTPException as e:
        _log_pipeline_error(youtube_url, "duplicate_check", e)
        raise
    except Exception as e:
        _log_pipeline_error(youtube_url, "duplicate_check", e)
        raise HTTPException(
            status_code=503, detail="Database service temporarily unavailable"
        )

    if is_duplicate:
        raise HTTPException(status_code=409, detail="Video already processed")

    # Step 3: Fetch metadata → get channel_name and published_at
    try:
        metadata = await fetch_metadata(parsed.video_id)
    except HTTPException as e:
        _log_pipeline_error(youtube_url, "metadata_fetch", e)
        raise
    except Exception as e:
        _log_pipeline_error(youtube_url, "metadata_fetch", e)
        raise HTTPException(
            status_code=502, detail="Could not retrieve video metadata"
        )

    # Step 4: Fetch transcript → get transcript text
    try:
        transcript = fetch_transcript(parsed.video_id)
    except HTTPException as e:
        _log_pipeline_error(youtube_url, "transcript_fetch", e)
        raise
    except Exception as e:
        _log_pipeline_error(youtube_url, "transcript_fetch", e)
        raise HTTPException(
            status_code=422, detail="Transcript unavailable for this video"
        )

    # Step 5: Parse recommendations via LLM → get list[Recommendation]
    try:
        recommendations = await parse_recommendations(transcript, metadata)
    except HTTPException as e:
        _log_pipeline_error(youtube_url, "llm_parse", e)
        raise
    except Exception as e:
        _log_pipeline_error(youtube_url, "llm_parse", e)
        raise HTTPException(status_code=502, detail=f"Could not parse recommendations: {type(e).__name__}: {e}")

    # Step 6: Persist to database → channel upsert, video insert, recommendations insert
    try:
        await persist_extraction(
            channel_name=metadata.channel_name,
            youtube_video_id=parsed.video_id,
            video_url=parsed.canonical_url,
            published_at=metadata.published_at,
            recommendations=recommendations,
        )
    except HTTPException as e:
        _log_pipeline_error(youtube_url, "database_insert", e)
        raise
    except Exception as e:
        _log_pipeline_error(youtube_url, "database_insert", e)
        raise HTTPException(status_code=500, detail="Internal error, please try again")

    return ExtractionResponse(
        status="success",
        channel_name=metadata.channel_name,
        video_id=parsed.video_id,
        published_at=metadata.published_at,
        tickers_extracted=[rec.ticker for rec in recommendations],
        recommendation_count=len(recommendations),
    )
