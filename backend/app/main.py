"""YTPortfolio API - FastAPI application for YouTube stock recommendation extraction."""

import json
import logging
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.auth import verify_owner
from app.database import check_duplicate, persist_extraction
from app.llm_parser import parse_recommendations
from app.metadata import fetch_metadata
from app.schemas import ExtractionRequest, ExtractionResponse
from app.transcript import fetch_transcript
from app.url_parser import parse_url

logger = logging.getLogger(__name__)

app = FastAPI(title="Aura API")

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


@app.get("/api/v1/version")
async def get_version():
    """Return the deployed backend commit hash."""
    return {
        "commit": os.environ.get("COMMIT_HASH", "dev"),
        "build_date": os.environ.get("BUILD_DATE", ""),
    }


@app.get("/api/v1/debug-transcript/{video_id}")
async def debug_transcript(
    video_id: str,
):
    """Debug endpoint to test transcript fetch methods in isolation."""
    from app.transcript import _fetch_transcript_ytdlp, _build_api, _fetch_via_worker

    results = {}

    # Test Cloudflare Worker (primary method)
    try:
        worker_url = os.environ.get("TRANSCRIPT_WORKER_URL", "")
        results["worker_config"] = {"url": worker_url, "configured": bool(worker_url)}

        if worker_url:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{worker_url}/transcript",
                    params={"v": video_id},
                )
                results["worker"] = {
                    "status_code": resp.status_code,
                    "success": resp.status_code == 200,
                    "response": resp.json() if resp.status_code != 200 else {
                        "length": len(resp.json().get("transcript", "")),
                        "preview": resp.json().get("transcript", "")[:200],
                    },
                }
        else:
            results["worker"] = {"success": False, "error": "Not configured"}
    except Exception as e:
        results["worker"] = {"success": False, "error": f"{type(e).__name__}: {e}"}

    # Test youtube-transcript-api (no proxy)
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        api = YouTubeTranscriptApi()
        import asyncio
        result = await asyncio.to_thread(api.fetch, video_id, languages=["en", "en-US", "en-GB"])
        text = " ".join(s.text for s in result.snippets)
        results["yt_api_no_proxy"] = {"success": True, "length": len(text), "preview": text[:200]}
    except Exception as e:
        results["yt_api_no_proxy"] = {"success": False, "error": f"{type(e).__name__}: {str(e)[:300]}"}

    # Test youtube-transcript-api (with proxy)
    try:
        api = _build_api()
        import asyncio
        result = await asyncio.to_thread(api.fetch, video_id, languages=["en", "en-US", "en-GB"])
        text = " ".join(s.text for s in result.snippets)
        results["yt_api_proxy"] = {"success": True, "length": len(text), "preview": text[:200]}
    except Exception as e:
        results["yt_api_proxy"] = {"success": False, "error": f"{type(e).__name__}: {str(e)[:300]}"}

    return results


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
        transcript = await fetch_transcript(parsed.video_id)
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
        recommendations, video_summary = await parse_recommendations(transcript, metadata)
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
            transcript=transcript,
            video_summary=video_summary,
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


@app.post("/api/v1/extract/stream")
async def extract_stream(
    request: Request,
    _owner: str = Depends(verify_owner),
) -> StreamingResponse:
    """Stream extraction progress via Server-Sent Events.

    Sends events for each pipeline stage so the frontend can show real-time progress.
    Event format: {"step": str, "status": "running"|"done"|"error", "detail"?: str}
    Final event on success: {"step": "complete", "status": "done", "result": {...}}
    """
    body = await request.json()
    youtube_url = body.get("youtube_url", "")
    client_transcript = body.get("transcript")  # Optional: sent from browser

    async def event_stream():
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        # Step 1: Parse URL
        yield sse({"step": "url_parse", "status": "running", "detail": "Parsing YouTube URL..."})
        try:
            parsed = parse_url(youtube_url)
        except HTTPException as e:
            _log_pipeline_error(youtube_url, "url_parsing", e)
            yield sse({"step": "url_parse", "status": "error", "detail": e.detail})
            return
        except Exception as e:
            _log_pipeline_error(youtube_url, "url_parsing", e)
            yield sse({"step": "url_parse", "status": "error", "detail": "URL format not recognized"})
            return
        yield sse({"step": "url_parse", "status": "done", "detail": f"Video ID: {parsed.video_id}"})

        # Step 2: Duplicate check
        yield sse({"step": "duplicate_check", "status": "running", "detail": "Checking for duplicates..."})
        try:
            is_duplicate = await check_duplicate(parsed.video_id)
        except HTTPException as e:
            _log_pipeline_error(youtube_url, "duplicate_check", e)
            yield sse({"step": "duplicate_check", "status": "error", "detail": e.detail})
            return
        except Exception as e:
            _log_pipeline_error(youtube_url, "duplicate_check", e)
            yield sse({"step": "duplicate_check", "status": "error", "detail": "Database service temporarily unavailable"})
            return

        if is_duplicate:
            yield sse({"step": "duplicate_check", "status": "error", "detail": "Video already processed"})
            return
        yield sse({"step": "duplicate_check", "status": "done", "detail": "New video confirmed"})

        # Step 3: Fetch metadata
        yield sse({"step": "metadata", "status": "running", "detail": "Fetching video metadata..."})
        try:
            metadata = await fetch_metadata(parsed.video_id)
        except HTTPException as e:
            _log_pipeline_error(youtube_url, "metadata_fetch", e)
            yield sse({"step": "metadata", "status": "error", "detail": e.detail})
            return
        except Exception as e:
            _log_pipeline_error(youtube_url, "metadata_fetch", e)
            yield sse({"step": "metadata", "status": "error", "detail": "Could not retrieve video metadata"})
            return
        yield sse({"step": "metadata", "status": "done", "detail": f"Channel: {metadata.channel_name}"})

        # Step 4: Fetch transcript
        yield sse({"step": "transcript", "status": "running", "detail": "Fetching transcript..."})

        # Use client-provided transcript if available (bypasses server-side IP blocks)
        if client_transcript and len(client_transcript.strip()) > 50:
            transcript = client_transcript.strip()
            word_count = len(transcript.split())
            yield sse({"step": "transcript", "status": "done", "detail": f"~{word_count:,} words (from browser)"})
        else:
            try:
                retry_events: list[dict] = []

                def on_transcript_retry(attempt: int, max_retries: int, error: str, delay: int):
                    retry_events.append({
                        "step": "transcript",
                        "status": "retrying",
                        "detail": f"Retry {attempt}/{max_retries} — {error}, waiting {delay}s...",
                    })

                transcript = await fetch_transcript(parsed.video_id, on_retry=on_transcript_retry)

                # Emit any retry events that accumulated
                for evt in retry_events:
                    yield sse(evt)
            except HTTPException as e:
                # Emit any accumulated retries before the final error
                for evt in retry_events:
                    yield sse(evt)
                _log_pipeline_error(youtube_url, "transcript_fetch", e)
                yield sse({"step": "transcript", "status": "error", "detail": e.detail})
                return
            except Exception as e:
                for evt in retry_events:
                    yield sse(evt)
                _log_pipeline_error(youtube_url, "transcript_fetch", e)
                yield sse({"step": "transcript", "status": "error", "detail": "Transcript unavailable for this video"})
                return
            word_count = len(transcript.split())
            yield sse({"step": "transcript", "status": "done", "detail": f"~{word_count:,} words"})

        # Step 5: LLM extraction
        yield sse({"step": "llm_parse", "status": "running", "detail": "Extracting recommendations via AI..."})
        try:
            llm_retry_events: list[dict] = []

            def on_llm_retry(attempt: int, max_retries: int, reason: str, delay: float):
                llm_retry_events.append({
                    "step": "llm_parse",
                    "status": "retrying",
                    "detail": f"Retry {attempt}/{max_retries} — {reason}" + (f", waiting {delay:.0f}s..." if delay > 0 else ""),
                })

            recommendations, video_summary = await parse_recommendations(transcript, metadata, on_retry=on_llm_retry)

            # Emit any retry events that accumulated
            for evt in llm_retry_events:
                yield sse(evt)
        except HTTPException as e:
            for evt in llm_retry_events:
                yield sse(evt)
            _log_pipeline_error(youtube_url, "llm_parse", e)
            yield sse({"step": "llm_parse", "status": "error", "detail": e.detail})
            return
        except Exception as e:
            for evt in llm_retry_events:
                yield sse(evt)
            _log_pipeline_error(youtube_url, "llm_parse", e)
            yield sse({"step": "llm_parse", "status": "error", "detail": f"LLM parsing failed: {type(e).__name__}"})
            return
        tickers = [rec.ticker for rec in recommendations]
        yield sse({"step": "llm_parse", "status": "done", "detail": f"Found {len(tickers)} ticker(s): {', '.join(tickers) or 'none'}"})

        # Step 6: Persist to database
        yield sse({"step": "database", "status": "running", "detail": "Saving to database..."})
        try:
            await persist_extraction(
                channel_name=metadata.channel_name,
                youtube_video_id=parsed.video_id,
                video_url=parsed.canonical_url,
                published_at=metadata.published_at,
                recommendations=recommendations,
                transcript=transcript,
                video_summary=video_summary,
            )
        except HTTPException as e:
            _log_pipeline_error(youtube_url, "database_insert", e)
            yield sse({"step": "database", "status": "error", "detail": e.detail})
            return
        except Exception as e:
            _log_pipeline_error(youtube_url, "database_insert", e)
            yield sse({"step": "database", "status": "error", "detail": "Internal error, please try again"})
            return
        yield sse({"step": "database", "status": "done", "detail": "Persisted successfully"})

        # Final success event
        yield sse({
            "step": "complete",
            "status": "done",
            "result": {
                "channel_name": metadata.channel_name,
                "video_id": parsed.video_id,
                "published_at": metadata.published_at,
                "tickers_extracted": tickers,
                "recommendation_count": len(recommendations),
            },
        })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
