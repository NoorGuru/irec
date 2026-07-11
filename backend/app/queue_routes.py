import os
import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Query
from pydantic import BaseModel

from app.auth import verify_owner
from app.database import _get_client, persist_extraction, check_duplicate
from app.metadata import fetch_metadata
from app.transcript import fetch_transcript
from app.llm_parser import parse_recommendations

logger = logging.getLogger(__name__)
router = APIRouter(tags=["queue"])

SCHEDULER_API_KEY = os.getenv("SCHEDULER_API_KEY")

async def verify_scheduler(request: Request):
    if not SCHEDULER_API_KEY:
        # If not set, allow for dev testing but log warning
        logger.warning("SCHEDULER_API_KEY is not configured in env")
        return
    key = request.headers.get("X-Scheduler-Key")
    if key != SCHEDULER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid scheduler key")


# --- Models ---
class ProcessQueueRequest(BaseModel):
    video_ids: List[str]

class DismissQueueRequest(BaseModel):
    video_ids: List[str]
    action: str = "dismiss"  # "dismiss", "snooze", "restore"

class CheckChannelsRequest(BaseModel):
    bucket: str  # "A" or "B"


# --- Queue Query Endpoints ---

@router.get("/api/v1/queue/videos")
async def get_queue_videos(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100)
):
    """Retrieve videos from the video queue, optionally filtered by status."""
    try:
        client = _get_client()
        query = client.table("video_queue").select("*")
        if status:
            query = query.eq("status", status)
        
        # Default order by published_at DESC or discovered_at DESC
        query = query.order("published_at", desc=True).limit(limit)
        res = query.execute()
        return res.data
    except Exception as e:
        logger.error(f"Error fetching queue videos: {e}")
        raise HTTPException(status_code=500, detail="Database fetch failed")


@router.get("/api/v1/queue/stats")
async def get_queue_stats():
    """Retrieve aggregate counts for each status in the video queue."""
    try:
        client = _get_client()
        # Fetch status column from all video queue entries to aggregate
        res = client.table("video_queue").select("status").execute()
        
        counts = {
            "discovered": 0,
            "pending_captions": 0,
            "fetching_captions": 0,
            "ready_for_ai": 0,
            "processing_ai": 0,
            "completed": 0,
            "caption_failed": 0,
            "ai_failed": 0,
            "dismissed": 0,
            "snoozed": 0
        }
        
        for item in res.data:
            stat = item.get("status")
            if stat in counts:
                counts[stat] += 1
                
        return counts
    except Exception as e:
        logger.error(f"Error calculating queue stats: {e}")
        raise HTTPException(status_code=500, detail="Stats calculation failed")


# --- Queue Actions (Owner Only) ---

@router.post("/api/v1/queue/process")
async def process_queue_videos(
    req: ProcessQueueRequest,
    _email: str = Depends(verify_owner)
):
    """Trigger AI recommendations extraction for a batch of ready_for_ai videos."""
    client = _get_client()
    results = []
    
    for vid_id in req.video_ids:
        # Get video details
        res = client.table("video_queue").select("*").eq("id", vid_id).single().execute()
        if not res.data:
            results.append({"id": vid_id, "status": "error", "error": "Video not found in queue"})
            continue
            
        video = res.data
        if video["status"] not in ["ready_for_ai", "ai_failed"]:
            results.append({"id": vid_id, "status": "error", "error": f"Invalid video status: {video['status']}"})
            continue
            
        # 1. Update queue status
        client.table("video_queue").update({
            "status": "processing_ai",
            "ai_triggered_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", vid_id).execute()
        
        try:
            # Check duplicate again in database before persisting
            dup_exist = await check_duplicate(video["youtube_video_id"])
            if dup_exist:
                raise Exception("Duplicate check failed: video already exists in extracted database")
                
            # 2. Get channel thumbnail if available
            channel_thumbnail_url = None
            if video["channel_id"]:
                ch_res = client.table("channels").select("channel_thumbnail_url").eq("channel_id", video["channel_id"]).single().execute()
                if ch_res.data:
                    channel_thumbnail_url = ch_res.data.get("channel_thumbnail_url")
            
            # 3. Parse recommendations using AI
            meta_input = {
                "channel_name": video["channel_name"] or "Unknown Channel",
                "published_at": video["published_at"],
                "title": video["title"] or "Unknown Title",
                "duration": video["duration"] or ""
            }
            
            # Run Claude LLM parse
            extracted = await parse_recommendations(video["transcript"], meta_input)
            
            # 4. Save to target database
            db_res = await persist_extraction(
                channel_name=video["channel_name"] or "Unknown Channel",
                youtube_video_id=video["youtube_video_id"],
                video_url=video["video_url"],
                published_at=video["published_at"],
                recommendations=extracted.recommendations,
                transcript=video["transcript"],
                video_summary=extracted.summary,
                youtube_channel_id=video["channel_id"], # fallback/will be resolved in upsert
                title=video["title"],
                duration=video["duration"],
                channel_thumbnail_url=channel_thumbnail_url
            )
            
            # 5. Mark as completed in queue
            client.table("video_queue").update({
                "status": "completed",
                "ai_completed_at": datetime.now(timezone.utc).isoformat(),
                "ai_error": None
            }).eq("id", vid_id).execute()
            
            results.append({"id": vid_id, "status": "success", "video_id": db_res.get("video_id")})
            
        except Exception as e:
            logger.error(f"Failed parsing video {vid_id} via AI: {e}")
            client.table("video_queue").update({
                "status": "ai_failed",
                "ai_error": str(e)
            }).eq("id", vid_id).execute()
            
            results.append({"id": vid_id, "status": "error", "error": str(e)})
            
    return {"results": results}


@router.post("/api/v1/queue/dismiss")
async def dismiss_queue_videos(
    req: DismissQueueRequest,
    _email: str = Depends(verify_owner)
):
    """Dismiss, snooze, or restore batch of queue entries."""
    client = _get_client()
    target_status = "dismissed"
    if req.action == "snooze":
        target_status = "snoozed"
    elif req.action == "restore":
        target_status = "ready_for_ai" # Fallback status
        
    try:
        update_data = {
            "status": target_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        if target_status == "dismissed":
            update_data["dismissed_at"] = datetime.now(timezone.utc).isoformat()
            
        res = client.table("video_queue").update(update_data).in_("id", req.video_ids).execute()
        return {"count": len(res.data), "status": target_status}
    except Exception as e:
        logger.error(f"Error dismissing/snoozing videos: {e}")
        raise HTTPException(status_code=500, detail="Action failed")


@router.post("/api/v1/queue/retry-captions")
async def retry_captions(
    req: ProcessQueueRequest,
    _email: str = Depends(verify_owner)
):
    """Reset caption attempt counters and set status back to discovered for retry."""
    client = _get_client()
    try:
        res = client.table("video_queue").update({
            "status": "discovered",
            "caption_attempts": 0,
            "caption_error": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).in_("id", req.video_ids).execute()
        return {"count": len(res.data)}
    except Exception as e:
        logger.error(f"Error retrying captions: {e}")
        raise HTTPException(status_code=500, detail="Caption retry action failed")


# --- Scheduler Trigger Endpoints (Scheduler API Key Auth Only) ---

async def fetch_playlist_items(playlist_id: str, max_results: int = 10) -> List[dict]:
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise Exception("YOUTUBE_API_KEY not configured")
        
    url = "https://www.googleapis.com/youtube/v3/playlistItems"
    params = {
        "part": "snippet,contentDetails",
        "playlistId": playlist_id,
        "maxResults": max_results,
        "key": api_key
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        
        videos = []
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            content_details = item.get("contentDetails", {})
            video_id = content_details.get("videoId") or snippet.get("resourceId", {}).get("videoId")
            
            if not video_id:
                continue
                
            videos.append({
                "youtube_video_id": video_id,
                "title": snippet.get("title"),
                "published_at": snippet.get("publishedAt"),
                "thumbnail_url": snippet.get("thumbnails", {}).get("medium", {}).get("url") or snippet.get("thumbnails", {}).get("default", {}).get("url")
            })
        return videos


@router.post("/api/v1/scheduler/check-channels")
async def check_channels(
    req: CheckChannelsRequest,
    _auth = Depends(verify_scheduler)
):
    """Scan monitored channels in the given bucket for new uploads."""
    start_time = datetime.now(timezone.utc)
    client = _get_client()
    
    channels_checked = 0
    new_videos_found = 0
    errors = []
    
    try:
        # Get channels in bucket
        ch_res = client.table("channels")\
            .select("channel_id, channel_name, youtube_channel_id")\
            .eq("schedule_bucket", req.bucket)\
            .eq("is_monitored", True)\
            .execute()
            
        for channel in ch_res.data:
            channels_checked += 1
            yt_id = channel.get("youtube_channel_id")
            if not yt_id:
                continue
                
            # Playlists uploads ID matches UC -> UU replacement
            uploads_playlist = yt_id
            if yt_id.startswith("UC"):
                uploads_playlist = "UU" + yt_id[2:]
                
            try:
                videos = await fetch_playlist_items(uploads_playlist, max_results=10)
                
                for v in videos:
                    # Check if already in extracted videos or queue
                    is_dup = await check_duplicate(v["youtube_video_id"])
                    if is_dup:
                        continue
                        
                    q_res = client.table("video_queue").select("id").eq("youtube_video_id", v["youtube_video_id"]).execute()
                    if q_res.data:
                        continue
                        
                    # Fresh video discovered! Insert to queue
                    client.table("video_queue").insert({
                        "youtube_video_id": v["youtube_video_id"],
                        "video_url": f"https://www.youtube.com/watch?v={v['youtube_video_id']}",
                        "channel_id": channel["channel_id"],
                        "channel_name": channel["channel_name"],
                        "title": v["title"],
                        "published_at": v["published_at"],
                        "thumbnail_url": v["thumbnail_url"],
                        "status": "discovered"
                    }).execute()
                    new_videos_found += 1
                    
            except Exception as ex:
                err_msg = f"Failed checking channel {channel.get('channel_name')}: {ex}"
                logger.error(err_msg)
                errors.append({"channel": channel.get("channel_name"), "error": str(ex)})
                
            # Update last_checked_at timestamp for channel
            client.table("channels").update({
                "last_checked_at": datetime.now(timezone.utc).isoformat()
            }).eq("channel_id", channel["channel_id"]).execute()
            
        # Log successful run
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((completed_at - start_time).total_seconds() * 1000)
        
        client.table("scheduler_log").insert({
            "run_type": "channel_check",
            "schedule_bucket": req.bucket,
            "channels_checked": channels_checked,
            "new_videos_found": new_videos_found,
            "errors": errors,
            "started_at": start_time.isoformat(),
            "completed_at": completed_at.isoformat(),
            "duration_ms": duration_ms
        }).execute()
        
        return {
            "channels_checked": channels_checked,
            "new_videos_found": new_videos_found,
            "errors": errors
        }
    except Exception as e:
        logger.error(f"Critical scheduler error: {e}")
        # Log fallback log
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((completed_at - start_time).total_seconds() * 1000)
        try:
            client.table("scheduler_log").insert({
                "run_type": "channel_check",
                "schedule_bucket": req.bucket,
                "errors": [{"error": f"Critical system error: {str(e)}"}],
                "started_at": start_time.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_ms": duration_ms
            }).execute()
        except:
            pass
        raise HTTPException(status_code=500, detail="Scheduler check run failed")


@router.post("/api/v1/scheduler/fetch-captions")
async def fetch_captions(
    _auth = Depends(verify_scheduler)
):
    """Fetch transcripts/captions for queue videos waiting for them (discovered / pending)."""
    start_time = datetime.now(timezone.utc)
    client = _get_client()
    
    captions_attempted = 0
    captions_succeeded = 0
    captions_failed = 0
    errors = []
    
    try:
        # Get up to 10 videos needing captions (oldest first)
        res = client.table("video_queue")\
            .select("*")\
            .in_("status", ["discovered", "pending_captions"])\
            .lt("caption_attempts", 5)\
            .order("discovered_at", descending=False)\
            .limit(10)\
            .execute()
            
        for video in res.data:
            captions_attempted += 1
            vid_id = video["id"]
            yt_id = video["youtube_video_id"]
            
            # Transition status
            client.table("video_queue").update({"status": "fetching_captions"}).eq("id", vid_id).execute()
            
            try:
                # Fetch metadata again to make sure we have duration
                duration = video.get("duration")
                if not duration:
                    try:
                        meta = await fetch_metadata(yt_id)
                        duration = meta.duration
                    except:
                        pass
                
                # Fetch transcript via core helper
                transcript = await fetch_transcript(yt_id)
                
                # Success -> Transition to ready_for_ai
                client.table("video_queue").update({
                    "status": "ready_for_ai",
                    "transcript": transcript,
                    "duration": duration,
                    "caption_attempts": video["caption_attempts"] + 1,
                    "last_caption_attempt_at": datetime.now(timezone.utc).isoformat(),
                    "caption_error": None
                }).eq("id", vid_id).execute()
                
                captions_succeeded += 1
                
            except Exception as ex:
                captions_failed += 1
                attempts = video["caption_attempts"] + 1
                new_status = "caption_failed" if attempts >= 5 else "pending_captions"
                
                client.table("video_queue").update({
                    "status": new_status,
                    "caption_attempts": attempts,
                    "caption_error": str(ex),
                    "last_caption_attempt_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", vid_id).execute()
                
                errors.append({"video_id": yt_id, "error": str(ex)})
                
        # Log successful run
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((completed_at - start_time).total_seconds() * 1000)
        
        client.table("scheduler_log").insert({
            "run_type": "caption_fetch",
            "captions_attempted": captions_attempted,
            "captions_succeeded": captions_succeeded,
            "captions_failed": captions_failed,
            "errors": errors,
            "started_at": start_time.isoformat(),
            "completed_at": completed_at.isoformat(),
            "duration_ms": duration_ms
        }).execute()
        
        return {
            "captions_attempted": captions_attempted,
            "captions_succeeded": captions_succeeded,
            "captions_failed": captions_failed,
            "errors": errors
        }
    except Exception as e:
        logger.error(f"Critical scheduler caption fetch error: {e}")
        # Log fallback log
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((completed_at - start_time).total_seconds() * 1000)
        try:
            client.table("scheduler_log").insert({
                "run_type": "caption_fetch",
                "errors": [{"error": f"Critical system error: {str(e)}"}],
                "started_at": start_time.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_ms": duration_ms
            }).execute()
        except:
            pass
        raise HTTPException(status_code=500, detail="Scheduler caption fetch run failed")


@router.get("/api/v1/scheduler/logs")
async def get_scheduler_logs(
    limit: int = Query(5, ge=1, le=20)
):
    """Retrieve recent scheduler run logs."""
    try:
        client = _get_client()
        res = client.table("scheduler_log").select("*").order("started_at", desc=True).limit(limit).execute()
        return res.data
    except Exception as e:
        logger.error(f"Error fetching scheduler logs: {e}")
        raise HTTPException(status_code=500, detail="Fetch logs failed")
