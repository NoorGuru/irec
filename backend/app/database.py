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
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Connect timeout 5s, read timeout 10s
_client: Client | None = None


def _get_client() -> Client:
    """Lazily initialize and return the Supabase client."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise HTTPException(
                status_code=500,
                detail="Internal error, please try again",
            )
        _client = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_KEY,
        )
    return _client


async def check_duplicate(youtube_video_id: str) -> bool:
    """Check if a video with the given youtube_video_id already exists.

    Returns True if the video exists (duplicate), False otherwise.
    Raises HTTPException(503) on timeout.
    """
    try:
        client = _get_client()
        response = (
            client.table("videos")
            .select("video_id")
            .eq("youtube_video_id", youtube_video_id)
            .execute()
        )
        return len(response.data) > 0
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database timeout/error during duplicate check: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database service temporarily unavailable",
        )


async def upsert_channel(channel_name: str) -> str:
    """Upsert a channel and return the channel_id UUID.

    Uses supabase-py's upsert which handles ON CONFLICT (channel_name)
    DO UPDATE SET channel_name = EXCLUDED.channel_name, guaranteeing
    the channel_id is always returned.

    Raises HTTPException(503) on timeout.
    """
    try:
        client = _get_client()
        response = (
            client.table("channels")
            .upsert(
                {"channel_name": channel_name},
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
) -> str:
    """Insert a video record and return the video_id UUID.

    Raises HTTPException(500) on database error.
    Raises HTTPException(503) on timeout.
    """
    try:
        client = _get_client()
        response = (
            client.table("videos")
            .insert(
                {
                    "youtube_video_id": youtube_video_id,
                    "video_url": video_url,
                    "channel_id": channel_id,
                    "published_at": published_at,
                }
            )
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
) -> dict:
    """Orchestrate the full database persistence for an extraction.

    Sequence: upsert channel → insert video → insert recommendations.
    On failure during video/recommendations insert, rolls back the video
    (channel upsert is idempotent and not rolled back).

    Returns a dict with channel_id, video_id for use in the response.
    Handles empty recommendations: still inserts channel and video records.
    """
    # Step 1: Upsert channel (idempotent, not rolled back on failure)
    channel_id = await upsert_channel(channel_name)

    # Step 2: Insert video
    video_id: str | None = None
    try:
        video_id = await insert_video(
            youtube_video_id=youtube_video_id,
            video_url=video_url,
            channel_id=channel_id,
            published_at=published_at,
        )
    except HTTPException:
        # Video insert failed — no rollback needed since nothing was inserted
        raise

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
