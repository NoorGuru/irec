"""Admin API routes for managing channels, videos, recommendations, and LLM logs.

All endpoints require owner authentication via verify_owner dependency.
Uses Supabase service key (bypasses RLS) for all database operations.
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import verify_owner
from app.database import _get_client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin",
    dependencies=[Depends(verify_owner)],
    tags=["admin"],
)


# ─── Schemas ───────────────────────────────────────────────────────────────────


class ChannelUpdate(BaseModel):
    trust_weight: float | None = Field(None, ge=0.0, le=5.0)
    channel_name: str | None = Field(None, min_length=1, max_length=200)


class ChannelMerge(BaseModel):
    source_id: str
    target_id: str


class VideoUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    video_summary: str | None = Field(None, max_length=5000)
    published_at: str | None = None


class RecommendationUpdate(BaseModel):
    ticker: str | None = Field(None, min_length=1, max_length=10)
    stock_name: str | None = Field(None, max_length=100)
    sentiment: int | None = Field(None, ge=-2, le=2)
    target_price: float | None = None
    conviction_level: int | None = Field(None, ge=1, le=10)
    catalyst_notes: str | None = Field(None, max_length=500)


class BulkReextractRequest(BaseModel):
    video_ids: list[str] = Field(..., min_length=1, max_length=50)


class PurgeRequest(BaseModel):
    older_than_days: int = Field(30, ge=1, le=365)
    success_only: bool = True


# ─── Channel Endpoints ─────────────────────────────────────────────────────────


@router.patch("/channels/{channel_id}")
async def update_channel(channel_id: str, body: ChannelUpdate):
    """Update a channel's trust_weight and/or name."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        client = _get_client()
        response = (
            client.table("channels")
            .update(update_data)
            .eq("channel_id", channel_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Channel not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update channel {channel_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str):
    """Delete a channel and cascade to all its videos and recommendations.

    Returns the count of deleted videos and recommendations for confirmation UI.
    """
    try:
        client = _get_client()

        # Verify channel exists
        ch_resp = (
            client.table("channels")
            .select("channel_id, channel_name")
            .eq("channel_id", channel_id)
            .execute()
        )
        if not ch_resp.data:
            raise HTTPException(status_code=404, detail="Channel not found")

        # Count related items for the response
        videos_resp = (
            client.table("videos")
            .select("video_id", count="exact")
            .eq("channel_id", channel_id)
            .execute()
        )
        video_count = videos_resp.count or 0

        # Count recommendations across all videos for this channel
        video_ids_resp = (
            client.table("videos")
            .select("video_id")
            .eq("channel_id", channel_id)
            .execute()
        )
        rec_count = 0
        if video_ids_resp.data:
            video_ids = [v["video_id"] for v in video_ids_resp.data]
            for vid in video_ids:
                recs_resp = (
                    client.table("recommendations")
                    .select("id", count="exact")
                    .eq("video_id", vid)
                    .execute()
                )
                rec_count += recs_resp.count or 0

        # Delete recommendations for all videos in this channel
        if video_ids_resp.data:
            video_ids = [v["video_id"] for v in video_ids_resp.data]
            for vid in video_ids:
                client.table("recommendations").delete().eq("video_id", vid).execute()

        # Delete videos
        client.table("videos").delete().eq("channel_id", channel_id).execute()

        # Delete channel
        client.table("channels").delete().eq("channel_id", channel_id).execute()

        return {
            "deleted": True,
            "channel_name": ch_resp.data[0]["channel_name"],
            "videos_deleted": video_count,
            "recommendations_deleted": rec_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete channel {channel_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.post("/channels/merge")
async def merge_channels(body: ChannelMerge):
    """Merge source channel into target channel.

    Re-assigns all videos from source to target, then deletes the source channel.
    """
    if body.source_id == body.target_id:
        raise HTTPException(status_code=400, detail="Cannot merge a channel with itself")

    try:
        client = _get_client()

        # Verify both channels exist
        source_resp = (
            client.table("channels")
            .select("channel_id, channel_name")
            .eq("channel_id", body.source_id)
            .execute()
        )
        target_resp = (
            client.table("channels")
            .select("channel_id, channel_name")
            .eq("channel_id", body.target_id)
            .execute()
        )

        if not source_resp.data:
            raise HTTPException(status_code=404, detail="Source channel not found")
        if not target_resp.data:
            raise HTTPException(status_code=404, detail="Target channel not found")

        # Re-assign all videos from source to target
        videos_resp = (
            client.table("videos")
            .select("video_id", count="exact")
            .eq("channel_id", body.source_id)
            .execute()
        )
        videos_moved = videos_resp.count or 0

        if videos_moved > 0:
            client.table("videos").update(
                {"channel_id": body.target_id}
            ).eq("channel_id", body.source_id).execute()

        # Delete the source channel (now has no videos)
        client.table("channels").delete().eq("channel_id", body.source_id).execute()

        return {
            "merged": True,
            "source_channel": source_resp.data[0]["channel_name"],
            "target_channel": target_resp.data[0]["channel_name"],
            "videos_moved": videos_moved,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to merge channels: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


# ─── Video Endpoints ───────────────────────────────────────────────────────────


@router.patch("/videos/{video_id}")
async def update_video(video_id: str, body: VideoUpdate):
    """Update fields on a single video."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        client = _get_client()
        response = (
            client.table("videos")
            .update(update_data)
            .eq("video_id", video_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Video not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.delete("/videos/{video_id}")
async def delete_video(video_id: str):
    """Delete a video and its recommendations (cascade)."""
    try:
        client = _get_client()

        # Verify video exists
        vid_resp = (
            client.table("videos")
            .select("video_id, title, youtube_video_id")
            .eq("video_id", video_id)
            .execute()
        )
        if not vid_resp.data:
            raise HTTPException(status_code=404, detail="Video not found")

        # Count recommendations
        recs_resp = (
            client.table("recommendations")
            .select("id", count="exact")
            .eq("video_id", video_id)
            .execute()
        )
        rec_count = recs_resp.count or 0

        # Delete recommendations first
        client.table("recommendations").delete().eq("video_id", video_id).execute()

        # Delete video
        client.table("videos").delete().eq("video_id", video_id).execute()

        return {
            "deleted": True,
            "title": vid_resp.data[0].get("title", ""),
            "recommendations_deleted": rec_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.post("/videos/bulk-reextract")
async def bulk_reextract(body: BulkReextractRequest):
    """Trigger re-extraction for multiple videos.

    For each video, fetches existing transcript and runs LLM extraction again.
    Returns results per video (success/failure).
    """
    from app.database import get_video_for_reextract, replace_recommendations, save_llm_response
    from app.llm_parser import parse_recommendations, LLMParseError
    from app.metadata import fetch_metadata

    results = []
    for video_id in body.video_ids:
        try:
            client = _get_client()

            # Get the youtube_video_id from video_id
            vid_resp = (
                client.table("videos")
                .select("youtube_video_id")
                .eq("video_id", video_id)
                .execute()
            )
            if not vid_resp.data:
                results.append({"video_id": video_id, "status": "error", "detail": "Not found"})
                continue

            youtube_video_id = vid_resp.data[0]["youtube_video_id"]

            # Get video data with transcript
            existing = await get_video_for_reextract(youtube_video_id)
            if not existing:
                results.append({"video_id": video_id, "status": "error", "detail": "No transcript"})
                continue

            # Fetch fresh metadata
            metadata = await fetch_metadata(youtube_video_id)

            # Run LLM
            recommendations, video_summary = await parse_recommendations(
                existing["transcript"], metadata
            )

            # Replace recommendations
            await replace_recommendations(
                video_id=existing["video_id"],
                recommendations=recommendations,
                video_summary=video_summary,
                title=metadata.title,
                duration=metadata.duration,
            )

            tickers = [r.ticker for r in recommendations]
            results.append({
                "video_id": video_id,
                "status": "success",
                "tickers": tickers,
                "count": len(tickers),
            })

        except LLMParseError as e:
            await save_llm_response(
                youtube_video_id=youtube_video_id,
                raw_response=e.raw_response,
                parse_success=False,
                error_detail=e.detail,
            )
            results.append({"video_id": video_id, "status": "error", "detail": f"LLM parse failed: {e.detail}"})
        except Exception as e:
            logger.error(f"Bulk re-extract failed for {video_id}: {e}")
            results.append({"video_id": video_id, "status": "error", "detail": str(e)[:200]})

    success_count = sum(1 for r in results if r["status"] == "success")
    return {
        "total": len(body.video_ids),
        "success": success_count,
        "failed": len(body.video_ids) - success_count,
        "results": results,
    }


# ─── Recommendation Endpoints ─────────────────────────────────────────────────


@router.patch("/recommendations/{rec_id}")
async def update_recommendation(rec_id: str, body: RecommendationUpdate):
    """Update fields on a single recommendation."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Uppercase ticker if provided
    if "ticker" in update_data:
        update_data["ticker"] = update_data["ticker"].upper().strip()

    try:
        client = _get_client()
        response = (
            client.table("recommendations")
            .update(update_data)
            .eq("id", rec_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Recommendation not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update recommendation {rec_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.delete("/recommendations/{rec_id}")
async def delete_recommendation(rec_id: str):
    """Delete a single recommendation."""
    try:
        client = _get_client()

        # Verify exists
        rec_resp = (
            client.table("recommendations")
            .select("id, ticker")
            .eq("id", rec_id)
            .execute()
        )
        if not rec_resp.data:
            raise HTTPException(status_code=404, detail="Recommendation not found")

        client.table("recommendations").delete().eq("id", rec_id).execute()

        return {"deleted": True, "ticker": rec_resp.data[0]["ticker"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete recommendation {rec_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


# ─── LLM Logs Endpoints ───────────────────────────────────────────────────────


@router.post("/llm-responses/{log_id}/retry")
async def retry_llm_extraction(log_id: str):
    """Retry LLM extraction for a failed log entry.

    Fetches the youtube_video_id from the log, then triggers re-extraction.
    """
    from app.database import get_video_for_reextract, replace_recommendations, save_llm_response
    from app.llm_parser import parse_recommendations, LLMParseError
    from app.metadata import fetch_metadata

    try:
        client = _get_client()

        # Get the log entry
        log_resp = (
            client.table("llm_responses")
            .select("id, youtube_video_id")
            .eq("id", log_id)
            .execute()
        )
        if not log_resp.data:
            raise HTTPException(status_code=404, detail="Log entry not found")

        youtube_video_id = log_resp.data[0]["youtube_video_id"]

        # Get video with transcript
        existing = await get_video_for_reextract(youtube_video_id)
        if not existing:
            raise HTTPException(
                status_code=422,
                detail="Video not found or has no transcript — cannot retry",
            )

        # Fetch metadata and run LLM
        metadata = await fetch_metadata(youtube_video_id)
        recommendations, video_summary = await parse_recommendations(
            existing["transcript"], metadata
        )

        # Replace recommendations
        await replace_recommendations(
            video_id=existing["video_id"],
            recommendations=recommendations,
            video_summary=video_summary,
            title=metadata.title,
            duration=metadata.duration,
        )

        # Save successful LLM response log
        await save_llm_response(
            youtube_video_id=youtube_video_id,
            raw_response="[retry successful]",
            parse_success=True,
        )

        tickers = [r.ticker for r in recommendations]
        return {
            "status": "success",
            "youtube_video_id": youtube_video_id,
            "tickers": tickers,
            "count": len(tickers),
        }

    except HTTPException:
        raise
    except LLMParseError as e:
        await save_llm_response(
            youtube_video_id=youtube_video_id,
            raw_response=e.raw_response,
            parse_success=False,
            error_detail=e.detail,
        )
        raise HTTPException(status_code=502, detail=f"LLM parse failed: {e.detail}")
    except Exception as e:
        logger.error(f"Retry failed for log {log_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


@router.delete("/llm-responses/purge")
async def purge_llm_responses(body: PurgeRequest):
    """Bulk delete LLM response logs based on age and success status."""
    try:
        client = _get_client()

        cutoff = (datetime.now(timezone.utc) - timedelta(days=body.older_than_days)).isoformat()

        query = client.table("llm_responses").delete().lt("created_at", cutoff)

        if body.success_only:
            query = query.eq("parse_success", True)

        response = query.execute()

        deleted_count = len(response.data) if response.data else 0

        return {
            "purged": True,
            "deleted_count": deleted_count,
            "older_than_days": body.older_than_days,
            "success_only": body.success_only,
        }
    except Exception as e:
        logger.error(f"Failed to purge LLM responses: {e}")
        raise HTTPException(status_code=500, detail="Internal error")


# ─── Stats Endpoint ────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats():
    """Return aggregated system health statistics."""
    try:
        client = _get_client()

        # Total channels
        ch_resp = client.table("channels").select("channel_id", count="exact").execute()
        total_channels = ch_resp.count or 0

        # Total videos
        vid_resp = client.table("videos").select("video_id", count="exact").execute()
        total_videos = vid_resp.count or 0

        # Total recommendations
        rec_resp = client.table("recommendations").select("id", count="exact").execute()
        total_recs = rec_resp.count or 0

        # LLM success/failure counts
        llm_all_resp = client.table("llm_responses").select("id", count="exact").execute()
        llm_total = llm_all_resp.count or 0

        llm_fail_resp = (
            client.table("llm_responses")
            .select("id", count="exact")
            .eq("parse_success", False)
            .execute()
        )
        llm_failures = llm_fail_resp.count or 0

        success_rate = round(((llm_total - llm_failures) / llm_total * 100), 1) if llm_total > 0 else 100.0

        # Weekly ingestions (last 4 weeks)
        weekly_ingestions = []
        now = datetime.now(timezone.utc)
        for week_offset in range(3, -1, -1):
            week_start = now - timedelta(weeks=week_offset + 1)
            week_end = now - timedelta(weeks=week_offset)
            week_resp = (
                client.table("videos")
                .select("video_id", count="exact")
                .gte("extracted_at", week_start.isoformat())
                .lt("extracted_at", week_end.isoformat())
                .execute()
            )
            weekly_ingestions.append({
                "week_start": week_start.strftime("%b %d"),
                "count": week_resp.count or 0,
            })

        # This week's ingestions
        this_week_start = now - timedelta(days=now.weekday())
        this_week_start = this_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        this_week_resp = (
            client.table("videos")
            .select("video_id", count="exact")
            .gte("extracted_at", this_week_start.isoformat())
            .execute()
        )
        this_week_count = this_week_resp.count or 0

        return {
            "total_channels": total_channels,
            "total_videos": total_videos,
            "total_recommendations": total_recs,
            "llm_failure_count": llm_failures,
            "success_rate": success_rate,
            "this_week_ingestions": this_week_count,
            "weekly_ingestions": weekly_ingestions,
        }
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
