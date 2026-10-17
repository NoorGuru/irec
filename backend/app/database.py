"""Database service for persisting extraction results to Supabase PostgreSQL.

Uses SUPABASE_SERVICE_KEY to bypass RLS for all write operations.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Callable, TypeVar

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


def _reset_client() -> None:
    """Reset the global Supabase client instance (used on connection drop / retry)."""
    global _client
    _client = None


T = TypeVar("T")


async def _with_db_retry(fn: Callable[[], T], max_retries: int = 2, delay: float = 0.5) -> T:
    """Execute a database operation with automatic retry on transient connection drops."""
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except HTTPException:
            raise
        except Exception as e:
            err_str = str(e).lower()
            err_type = type(e).__name__.lower()
            is_transient = (
                "timeout" in err_str
                or "timeout" in err_type
                or "connection" in err_str
                or "connection" in err_type
                or "remote" in err_type
                or "disconnect" in err_str
                or "reset" in err_str
                or "closed" in err_str
                or "broken pipe" in err_str
            )
            if is_transient and attempt < max_retries:
                logger.warning(
                    f"Transient database error on attempt {attempt + 1}/{max_retries + 1}: {e}. "
                    f"Resetting client and retrying in {delay}s..."
                )
                _reset_client()
                await asyncio.sleep(delay)
                continue
            raise


async def save_llm_response(
    youtube_video_id: str,
    raw_response: str,
    parse_success: bool,
    error_detail: str | None = None,
) -> None:
    """Persist raw LLM response for debugging (non-blocking).

    Saves on both success and failure. On failure, error_detail captures why parsing failed.
    Silently logs and continues if the save itself fails.
    """
    try:
        client = _get_client()
        record: dict = {
            "youtube_video_id": youtube_video_id,
            "raw_response": raw_response,
            "parse_success": parse_success,
        }
        if error_detail:
            record["error_detail"] = error_detail
        client.table("llm_responses").insert(record).execute()
    except Exception as e:
        logger.warning(f"Failed to save LLM response for {youtube_video_id}: {e}")


async def check_duplicate(youtube_video_id: str) -> bool:
    """Check if a video with the given youtube_video_id already exists AND has recommendations.

    Returns True if the video is fully processed (has recommendations), False otherwise.
    Raises HTTPException(503) on timeout.
    """
    try:
        def _query():
            client = _get_client()
            return (
                client.table("videos")
                .select("video_id, recommendations(ticker)")
                .eq("youtube_video_id", youtube_video_id)
                .execute()
            )

        response = await _with_db_retry(_query)
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


async def delete_existing_video(youtube_video_id: str) -> bool:
    """Delete an existing video and its recommendations (cascade via FK).

    Used by force re-ingest to clear stale data before re-processing.
    Returns True if a video was deleted, False if none found.
    Raises HTTPException(503) on database error.
    """
    try:
        def _delete():
            client = _get_client()
            # Find the video
            response = (
                client.table("videos")
                .select("video_id")
                .eq("youtube_video_id", youtube_video_id)
                .execute()
            )
            if not response.data:
                return None

            video_id = response.data[0]["video_id"]
            # Delete recommendations first (FK constraint)
            client.table("recommendations").delete().eq("video_id", video_id).execute()
            # Delete the video
            client.table("videos").delete().eq("video_id", video_id).execute()
            return video_id

        deleted_id = await _with_db_retry(_delete)
        if not deleted_id:
            return False

        logger.info(f"Force re-ingest: deleted existing video {youtube_video_id} (id: {deleted_id})")
        return True
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during force delete: {type(e).__name__}: {e}")
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


async def upsert_channel(
    channel_name: str,
    youtube_channel_id: str | None = None,
    channel_thumbnail_url: str | None = None,
) -> str:
    """Upsert a channel and return the channel_id UUID.

    Intelligently checks existing channel by youtube_channel_id first to prevent
    duplicate key collisions with idx_channels_youtube_channel_id when a channel
    is renamed on YouTube.

    Raises HTTPException(503) on timeout or connection failure.
    """
    clean_channel_name = channel_name.strip() if channel_name else ""
    if not clean_channel_name:
        clean_channel_name = channel_name or "Unknown Channel"

    try:
        # Step 1: If youtube_channel_id is provided, check if the channel already exists by ID
        if youtube_channel_id:
            try:
                def _find_by_yt_id():
                    client = _get_client()
                    return (
                        client.table("channels")
                        .select("channel_id, channel_name")
                        .eq("youtube_channel_id", youtube_channel_id)
                        .execute()
                    )

                res = await _with_db_retry(_find_by_yt_id)
                if res.data and len(res.data) > 0:
                    existing_id = res.data[0]["channel_id"]
                    # Update thumbnail or channel name if needed
                    update_record = {}
                    if channel_thumbnail_url:
                        update_record["channel_thumbnail_url"] = channel_thumbnail_url
                    if update_record:
                        try:
                            def _update_channel():
                                client = _get_client()
                                return client.table("channels").update(update_record).eq("channel_id", existing_id).execute()
                            await _with_db_retry(_update_channel)
                        except Exception as e:
                            logger.warning(f"Failed to update channel metadata for {existing_id}: {e}")
                    return existing_id
            except Exception as e:
                logger.warning(f"Lookup by youtube_channel_id {youtube_channel_id} failed: {e}")

        # Step 2: Fall back to upsert on channel_name
        record: dict = {"channel_name": clean_channel_name}
        if youtube_channel_id:
            record["youtube_channel_id"] = youtube_channel_id
        if channel_thumbnail_url:
            record["channel_thumbnail_url"] = channel_thumbnail_url

        def _do_upsert():
            client = _get_client()
            return (
                client.table("channels")
                .upsert(
                    record,
                    on_conflict="channel_name",
                )
                .execute()
            )

        try:
            response = await _with_db_retry(_do_upsert)
            if not response.data:
                raise HTTPException(
                    status_code=500,
                    detail="Internal error: channels table returned no data",
                )
            return response.data[0]["channel_id"]
        except Exception as upsert_err:
            err_msg = str(upsert_err).lower()
            # If unique constraint conflict on youtube_channel_id or channel_name
            if "youtube_channel_id" in err_msg or "23505" in err_msg or "unique" in err_msg:
                logger.warning(f"Channel upsert hit unique conflict ({upsert_err}), resolving by lookup...")
                if youtube_channel_id:
                    res = _get_client().table("channels").select("channel_id").eq("youtube_channel_id", youtube_channel_id).execute()
                    if res.data and len(res.data) > 0:
                        return res.data[0]["channel_id"]
                res = _get_client().table("channels").select("channel_id").eq("channel_name", clean_channel_name).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]["channel_id"]
            raise upsert_err

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database timeout/error during channel upsert: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Database service temporarily unavailable: {type(e).__name__}: {e}",
        )


async def insert_video(
    youtube_video_id: str,
    video_url: str,
    channel_id: str,
    published_at: str,
    transcript: str | None = None,
    video_summary: str | None = None,
    title: str | None = None,
    duration: str | None = None,
) -> str:
    """Insert a video record and return the video_id UUID.

    Raises HTTPException(500) on database error.
    Raises HTTPException(503) on timeout.
    """
    try:
        record: dict = {
            "youtube_video_id": youtube_video_id,
            "video_url": video_url,
            "channel_id": channel_id,
            "published_at": published_at,
        }
        if transcript is not None:
            record["transcript"] = transcript
        if video_summary is not None:
            record["video_summary"] = video_summary
        if title is not None:
            record["title"] = title
        if duration is not None:
            record["duration"] = duration

        def _insert():
            client = _get_client()
            return (
                client.table("videos")
                .insert(record)
                .execute()
            )

        response = await _with_db_retry(_insert)
        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Internal error: videos table returned no data",
            )
        return response.data[0]["video_id"]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during video insert: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error during video insert: {type(e).__name__}: {e}",
        )


async def get_video_for_reextract(youtube_video_id: str) -> dict | None:
    """Fetch existing video record with transcript for re-extraction.

    Returns dict with video_id, transcript, channel_name, published_at, video_url.
    Returns None if video doesn't exist or has no transcript.
    """
    try:
        client = _get_client()
        response = (
            client.table("videos")
            .select("video_id, transcript, published_at, video_url, channels(channel_name, youtube_channel_id)")
            .eq("youtube_video_id", youtube_video_id)
            .execute()
        )
        if not response.data:
            return None
        row = response.data[0]
        if not row.get("transcript"):
            return None
        return row
    except Exception as e:
        logger.error(f"Database error fetching video for re-extract: {e}")
        return None


def _build_recommendation_records(
    video_id: str,
    recommendations: list[Recommendation],
    include_calibrated: bool = True,
    include_initial: bool = True,
    include_verification: bool = True,
) -> list[dict]:
    """Format recommendation records for database insertion."""
    records = []
    for rec in recommendations:
        record = {
            "video_id": video_id,
            "ticker": rec.ticker,
            "stock_name": rec.stock_name,
            "sentiment": rec.sentiment,
            "target_price": rec.target_price,
            "conviction_level": rec.conviction_level,
            "catalyst_notes": rec.catalyst_notes,
        }
        if include_initial:
            if rec.initial_conviction_level is not None:
                record["initial_conviction_level"] = rec.initial_conviction_level
            if rec.initial_sentiment is not None:
                record["initial_sentiment"] = rec.initial_sentiment
        if include_calibrated:
            if rec.conviction_score is not None:
                record["conviction_score"] = rec.conviction_score
            if rec.conviction_confidence is not None:
                record["conviction_confidence"] = rec.conviction_confidence
            if rec.sentiment_score is not None:
                record["sentiment_score"] = rec.sentiment_score
            if rec.sentiment_confidence is not None:
                record["sentiment_confidence"] = rec.sentiment_confidence
            if rec.quote:
                record["quote"] = rec.quote
        if include_verification:
            if rec.target_price_verified is not None:
                record["target_price_verified"] = rec.target_price_verified
            if rec.is_verified is not None:
                record["is_verified"] = rec.is_verified
        records.append(record)
    return records


async def replace_recommendations(
    video_id: str,
    recommendations: list[Recommendation],
    video_summary: str | None = None,
    title: str | None = None,
    duration: str | None = None,
) -> None:
    """Replace all recommendations for a video with a new set."""
    try:
        client = _get_client()

        # Delete existing recommendations for this video
        client.table("recommendations").delete().eq("video_id", video_id).execute()

        # Optionally update video metadata if provided
        update_record = {}
        if video_summary is not None:
            update_record["video_summary"] = video_summary
        if title is not None:
            update_record["title"] = title
        if duration is not None:
            update_record["duration"] = duration

        if update_record:
            client.table("videos").update(update_record).eq("video_id", video_id).execute()

        # Insert new recommendations
        if recommendations:
            try:
                records = _build_recommendation_records(video_id, recommendations, include_calibrated=True, include_initial=True, include_verification=True)
                client.table("recommendations").insert(records).execute()
            except Exception as e:
                err_str = str(e).lower()
                if "target_price_verified" in err_str or "is_verified" in err_str:
                    logger.warning(f"Verification columns not yet migrated: {e}. Falling back without verification columns.")
                    try:
                        records = _build_recommendation_records(video_id, recommendations, include_calibrated=True, include_initial=True, include_verification=False)
                        client.table("recommendations").insert(records).execute()
                    except Exception as e2:
                        err_str2 = str(e2).lower()
                        if "initial_conviction_level" in err_str2 or "conviction_score" in err_str2 or "pgrst204" in err_str2 or "column" in err_str2:
                            records = _build_recommendation_records(video_id, recommendations, include_calibrated=False, include_initial=False, include_verification=False)
                            client.table("recommendations").insert(records).execute()
                        else:
                            raise
                elif "initial_conviction_level" in err_str or "conviction_score" in err_str or "pgrst204" in err_str or "column" in err_str:
                    logger.warning(f"New columns not yet migrated: {e}. Falling back to baseline columns.")
                    records = _build_recommendation_records(video_id, recommendations, include_calibrated=False, include_initial=False, include_verification=False)
                    client.table("recommendations").insert(records).execute()
                else:
                    raise
    except Exception as e:
        logger.error(f"Database error during replace_recommendations: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error during replace_recommendations: {type(e).__name__}: {e}",
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
        try:
            records = _build_recommendation_records(video_id, recommendations, include_calibrated=True, include_initial=True, include_verification=True)
            client.table("recommendations").insert(records).execute()
        except Exception as e:
            err_str = str(e).lower()
            if "target_price_verified" in err_str or "is_verified" in err_str:
                logger.warning(f"Verification columns not yet migrated: {e}. Falling back without verification columns.")
                try:
                    records = _build_recommendation_records(video_id, recommendations, include_calibrated=True, include_initial=True, include_verification=False)
                    client.table("recommendations").insert(records).execute()
                except Exception as e2:
                    err_str2 = str(e2).lower()
                    if "initial_conviction_level" in err_str2 or "conviction_score" in err_str2 or "pgrst204" in err_str2 or "column" in err_str2:
                        records = _build_recommendation_records(video_id, recommendations, include_calibrated=False, include_initial=False, include_verification=False)
                        client.table("recommendations").insert(records).execute()
                    else:
                        raise
            elif "initial_conviction_level" in err_str or "conviction_score" in err_str or "pgrst204" in err_str or "column" in err_str:
                logger.warning(f"New columns not yet migrated: {e}. Falling back to baseline columns.")
                records = _build_recommendation_records(video_id, recommendations, include_calibrated=False, include_initial=False, include_verification=False)
                client.table("recommendations").insert(records).execute()
            else:
                raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during recommendations insert: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error during recommendations insert: {type(e).__name__}: {e}",
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
    title: str | None = None,
    duration: str | None = None,
    channel_thumbnail_url: str | None = None,
) -> dict:
    """Orchestrate the full database persistence for an extraction.

    Sequence: upsert channel → upsert video → insert recommendations.
    On failure during video/recommendations insert, rolls back the video
    (channel upsert is idempotent and not rolled back).

    Returns a dict with channel_id, video_id for use in the response.
    Handles empty recommendations: still inserts channel and video records.
    """
    # Step 1: Upsert channel (idempotent, not rolled back on failure)
    channel_id = await upsert_channel(channel_name, youtube_channel_id, channel_thumbnail_url)

    # Step 2: Upsert video (may already exist from transcript cache)
    video_id: str | None = None
    try:
        def _upsert_video():
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
            if video_summary is not None:
                record["video_summary"] = video_summary
            if title is not None:
                record["title"] = title
            if duration is not None:
                record["duration"] = duration

            if existing.data:
                # Video exists (from transcript cache) — update it
                v_id = existing.data[0]["video_id"]
                client.table("videos").update(record).eq("video_id", v_id).execute()
                return v_id
            else:
                # New video — insert
                response = client.table("videos").insert(record).execute()
                if not response.data:
                    raise HTTPException(status_code=500, detail="Database error: video insert returned no data")
                return response.data[0]["video_id"]

        video_id = await _with_db_retry(_upsert_video)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during video upsert: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error during video upsert: {type(e).__name__}: {e}")

    # Step 3: Insert recommendations (skip if empty)
    try:
        await insert_recommendations(video_id, recommendations)
    except HTTPException as e:
        # Recommendations failed — rollback the video (cascades to any partial recs)
        await _rollback_video(video_id)
        raise HTTPException(
            status_code=e.status_code,
            detail=f"Recommendations failed: {e.detail}",
        )
    except Exception as e:
        await _rollback_video(video_id)
        raise HTTPException(
            status_code=500,
            detail=f"Recommendations failed: {type(e).__name__}: {e}",
        )

    return {
        "channel_id": channel_id,
        "video_id": video_id,
    }


async def get_cache(key: str) -> dict | None:
    """Retrieve cache payload from api_cache table.

    Returns dict with 'payload' and 'last_updated' (as ISO string) if found, None otherwise.
    """
    try:
        client = _get_client()
        response = (
            client.table("api_cache")
            .select("payload, last_updated")
            .eq("cache_key", key)
            .execute()
        )
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.warning(f"Cache miss/read error for key {key}: {e}")
        return None


async def set_cache(key: str, payload: dict) -> None:
    """Upsert cache payload in api_cache table."""
    try:
        client = _get_client()
        client.table("api_cache").upsert({
            "cache_key": key,
            "payload": payload,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to set cache for key {key}: {e}")


async def get_latest_extraction_time() -> str | None:
    """Get the latest timestamp for video extractions."""
    try:
        client = _get_client()
        vid_res = (
            client.table("videos")
            .select("extracted_at")
            .order("extracted_at", desc=True)
            .limit(1)
            .execute()
        )
        if vid_res.data:
            return vid_res.data[0]["extracted_at"]
        return None
    except Exception as e:
        logger.warning(f"Failed to get latest extraction time: {e}")
        return None
