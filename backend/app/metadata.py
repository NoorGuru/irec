"""Metadata Fetcher - Retrieves video metadata from YouTube Data API v3."""

import os

import httpx
from fastapi import HTTPException

from app.schemas import VideoMetadata

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"


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
        "part": "snippet",
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
    return VideoMetadata(
        channel_name=snippet["channelTitle"],
        youtube_channel_id=snippet["channelId"],
        published_at=snippet["publishedAt"],
    )
