"""Metadata Fetcher - Retrieves video metadata from YouTube Data API v3."""

import logging
import os

import httpx
from fastapi import HTTPException

from app.schemas import VideoMetadata

logger = logging.getLogger(__name__)

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"
YOUTUBE_CHANNELS_API_URL = "https://www.googleapis.com/youtube/v3/channels"


async def fetch_metadata(video_id: str) -> VideoMetadata:
    """Fetch channel name and publish date from YouTube Data API v3.

    Args:
        video_id: The 11-character YouTube video ID.

    Returns:
        VideoMetadata with channel_name and published_at fields.

    Raises:
        HTTPException(404): If the video is not found on YouTube.
        HTTPException(502): If the YouTube API returns an error or times out.
    """
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=502, detail="YouTube API key not configured")

    params = {
        "part": "snippet,contentDetails",
        "id": video_id,
        "key": api_key,
    }

    timeout = httpx.Timeout(10.0, connect=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(YOUTUBE_API_URL, params=params)
            response.raise_for_status()
    except (httpx.TimeoutException, httpx.HTTPStatusError):
        raise HTTPException(
            status_code=502,
            detail="Could not retrieve video metadata",
        )

    data = response.json()
    items = data.get("items", [])

    if not items:
        raise HTTPException(
            status_code=404,
            detail="Video not found on YouTube",
        )

    snippet = items[0]["snippet"]
    content_details = items[0].get("contentDetails", {})
    return VideoMetadata(
        channel_name=snippet["channelTitle"],
        youtube_channel_id=snippet["channelId"],
        published_at=snippet["publishedAt"],
        title=snippet.get("title", ""),
        duration=content_details.get("duration", ""),
    )


async def fetch_channel_thumbnail(youtube_channel_id: str) -> str | None:
    """Fetch a channel's profile thumbnail URL from YouTube Channels API.

    Args:
        youtube_channel_id: The YouTube channel ID (e.g. UCxxxxxx).

    Returns:
        The high-resolution thumbnail URL, or None if unavailable.
        Never raises — fails silently to avoid blocking the ingestion pipeline.
    """
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key or not youtube_channel_id:
        return None

    params = {
        "part": "snippet",
        "id": youtube_channel_id,
        "key": api_key,
    }

    timeout = httpx.Timeout(10.0, connect=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(YOUTUBE_CHANNELS_API_URL, params=params)
            response.raise_for_status()

        data = response.json()
        items = data.get("items", [])
        if not items:
            return None

        thumbnails = items[0].get("snippet", {}).get("thumbnails", {})
        # Prefer high > medium > default
        for size in ("high", "medium", "default"):
            if size in thumbnails and "url" in thumbnails[size]:
                return thumbnails[size]["url"]
        return None
    except Exception as e:
        logger.warning(f"Failed to fetch channel thumbnail for {youtube_channel_id}: {e}")
        return None
