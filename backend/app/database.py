"""Database service for persisting extraction results to Supabase PostgreSQL.

Uses SUPABASE_SERVICE_KEY to bypass RLS for all write operations.
"""

import logging
import os

from fastapi import HTTPException
from supabase import Client, create_client

from app.schemas import Recommendation

logger = logging.getLogger(__name__)

# Initialize Supabase client with service key (bypasses RLS)
_client: Client | None = None


def _get_client() -> Client:
    """Lazily initialize and return the Supabase client."""
    global _client
    if _client is None:
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_service_key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not supabase_url or not supabase_service_key:
            raise HTTPException(
                status_code=500,
                detail="Internal error, please try again",
            )
        # Ensure URL doesn't include /rest/v1/ suffix
        base_url = supabase_url.rstrip("/").replace("/rest/v1", "")
        _client = create_client(
            base_url,
            supabase_service_key,
        )
    return _client


async def check_duplicate(youtube_video_id: str) -> bool:
    """Check if a video with the given youtube_video_id already exists AND has recommendations.

    Returns True if the video is fully processed (has recommendations), False otherwise.
    Raises HTTPException(503) on timeout.
    """
    try:
        client = _get_client()
        response = (
            client.table("videos")
            .select("video_id, recommendations(ticker)")
            .eq("youtube_video_id", youtube_video_id)
            .execute()
        )
        if not response.data:
            return False
        # Only consider it a duplicate if it has recommendations (fully processed)
        recs = response.data[0].get("recommendations", [])
        return len(recs) > 0
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database timeout/error during duplicate check: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Database service temporarily unavailable: {type(e).__name__}: {e}",
        )


async def get_cached_transcript(youtube_video_id: str) -> str | None:
    """Check if we have a cached transcript for this video (from a previous partial run).

    Returns the transcript text if found, None otherwise.
    """
    try:
        client = _get_client()
        response = (
            client.table("videos")
            .select("transcript")
            .eq("youtube_video_id", youtube_video_id)
            .execute()
        )
        if response.data and response.data[0].get("transcript"):
            return response.data[0]["transcript"]
        return None
    except Exception:
        return None


async def save_transcript_cache(
    youtube_video_id: str,
    video_url: str,
    channel_name: str,
    published_at: str,
    transcript: str,
) -> None:
    """Save transcript early so retries don't need to re-fetch it.

    Creates the channel and video records if they don't exist.
    If the video already exists, updates the transcript.
    """
    try:
        client = _get_client()

        # Check if video already exists
        existing = (
            client.table("videos")
            .select("video_id")
            .eq("youtube_video_id", youtube_video_id)
            .execute()
        )

        if existing.data:
            # Update transcript if missing
            client.table("videos").update({"transcript": transcript}).eq(
                "youtube_video_id", youtube_video_id
            ).execute()
        else:
            # Create channel + video
            channel_id = await upsert_channel(channel_name)
            client.table("videos").insert({
                "youtube_video_id": youtube_video_id,
                "video_url": video_url,
                "channel_id": channel_id,
                "published_at": published_at,
                "transcript": transcript,
            }).execute()
    except Exception as e:
        # Non-fatal — just log, don't block the pipeline
        logger.warning(f"Failed to cache transcript for {youtube_video_id}: {e}")


async def upsert_channel(channel_name: str, youtube_channel_id: str | None = None) -> str:
    """Upsert a channel and return the channel_id UUID.

    Uses supabase-py's upsert which handles ON CONFLICT (channel_name)
    DO UPDATE SET channel_name = EXCLUDED.channel_name, guaranteeing
    the channel_id is always returned.

    Raises HTTPException(503) on timeout.
    """
    try:
        client = _get_client()
        record: dict = {"channel_name": channel_name}
        if youtube_channel_id:
            record["youtube_channel_id"] = youtube_channel_id
        response = (
            client.table("channels")
            .upsert(
                record,
                on_conflict="channel_name",
            )
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Internal error, please try again",
            )
        return response.data[0]["channel_id"]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database timeout/error during channel upsert: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database service temporarily unavailable",
        )


async def insert_video(
    youtube_video_id: str,
    video_url: str,
    channel_id: str,
    published_at: str,
    transcript: str | None = None,
    video_summary: str | None = None,
) -> str:
    """Insert a video record and return the video_id UUID.

    Raises HTTPException(500) on database error.
    Raises HTTPException(503) on timeout.
    """
    try:
        client = _get_client()
        record: dict = {
            "youtube_video_id": youtube_video_id,
            "video_url": video_url,
            "channel_id": channel_id,
            "published_at": published_at,
        }
        if transcript is not None:
            record["transcript"] = transcript
        if video_summary:
            record["video_summary"] = video_summary
        response = (
            client.table("videos")
            .insert(record)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Internal error, please try again",
            )
        return response.data[0]["video_id"]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during video insert: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal error, please try again",
        )


async def insert_recommendations(
    video_id: str, recommendations: list[Recommendation]
) -> None:
    """Batch insert recommendations linked to a video_id.

    Skips insertion if recommendations list is empty.
    Raises HTTPException(500) on database error.
    Raises HTTPException(503) on timeout.
    """
    if not recommendations:
        return

    try:
        client = _get_client()
        records = [
            {
                "video_id": video_id,
                "ticker": rec.ticker,
                "stock_name": rec.stock_name,
                "sentiment": rec.sentiment,
                "target_price": rec.target_price,
                "conviction_level": rec.conviction_level,
                "catalyst_notes": rec.catalyst_notes,
            }
            for rec in recommendations
        ]
        client.table("recommendations").insert(records).execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during recommendations insert: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal error, please try again",
        )


async def _rollback_video(video_id: str) -> None:
    """Delete a video record (cascades to recommendations via FK)."""
    try:
        client = _get_client()
        client.table("videos").delete().eq("video_id", video_id).execute()
    except Exception as e:
        logger.error(f"Failed to rollback video {video_id}: {e}")


async def persist_extraction(
    channel_name: str,
    youtube_video_id: str,
    video_url: str,
    published_at: str,
    recommendations: list[Recommendation],
    transcript: str | None = None,
    video_summary: str | None = None,
    youtube_channel_id: str | None = None,
) -> dict:
    """Orchestrate the full database persistence for an extraction.

    Sequence: upsert channel → upsert video → insert recommendations.
    On failure during video/recommendations insert, rolls back the video
    (channel upsert is idempotent and not rolled back).

    Returns a dict with channel_id, video_id for use in the response.
    Handles empty recommendations: still inserts channel and video records.
    """
    # Step 1: Upsert channel (idempotent, not rolled back on failure)
    channel_id = await upsert_channel(channel_name, youtube_channel_id)

    # Step 2: Upsert video (may already exist from transcript cache)
    video_id: str | None = None
    try:
        client = _get_client()
        existing = (
            client.table("videos")
            .select("video_id")
            .eq("youtube_video_id", youtube_video_id)
            .execute()
        )

        record: dict = {
            "youtube_video_id": youtube_video_id,
            "video_url": video_url,
            "channel_id": channel_id,
            "published_at": published_at,
        }
        if transcript is not None:
            record["transcript"] = transcript
        if video_summary:
            record["video_summary"] = video_summary

        if existing.data:
            # Video exists (from transcript cache) — update it
            video_id = existing.data[0]["video_id"]
            client.table("videos").update(record).eq("video_id", video_id).execute()
        else:
            # New video — insert
            response = client.table("videos").insert(record).execute()
            if not response.data:
                raise HTTPException(status_code=500, detail="Internal error, please try again")
            video_id = response.data[0]["video_id"]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during video upsert: {e}")
        raise HTTPException(status_code=500, detail="Internal error, please try again")

    # Step 3: Insert recommendations (skip if empty)
    try:
        await insert_recommendations(video_id, recommendations)
    except HTTPException:
        # Recommendations failed — rollback the video (cascades to any partial recs)
        await _rollback_video(video_id)
        raise HTTPException(
            status_code=500,
            detail="Internal error, please try again",
        )

    return {
        "channel_id": channel_id,
        "video_id": video_id,
    }
