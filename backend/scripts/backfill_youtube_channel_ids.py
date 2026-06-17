"""Backfill youtube_channel_id for existing channels.

Looks up one video per channel via the YouTube Data API to get the channelId,
then updates the channels table.

Usage:
    cd backend
    python -m scripts.backfill_youtube_channel_ids

Requires: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY in .env
"""

import os
import sys

import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    base_url = url.rstrip("/").replace("/rest/v1", "")
    return create_client(base_url, key)


def fetch_channel_id_from_video(video_id: str, api_key: str) -> str | None:
    """Fetch the YouTube channel ID from a video ID."""
    params = {"part": "snippet", "id": video_id, "key": api_key}
    try:
        resp = httpx.get(YOUTUBE_API_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if items:
            return items[0]["snippet"]["channelId"]
    except Exception as e:
        print(f"  ⚠ API error for video {video_id}: {e}")
    return None


def main():
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        print("Error: YOUTUBE_API_KEY not set")
        sys.exit(1)

    supabase = get_supabase()

    # Get channels missing youtube_channel_id
    channels_res = supabase.table("channels").select("channel_id, channel_name, youtube_channel_id").execute()
    channels = channels_res.data or []

    channels_to_update = [ch for ch in channels if not ch.get("youtube_channel_id")]

    if not channels_to_update:
        print("✓ All channels already have youtube_channel_id")
        return

    print(f"Found {len(channels_to_update)} channel(s) to backfill:\n")

    for ch in channels_to_update:
        channel_id = ch["channel_id"]
        channel_name = ch["channel_name"]

        # Get one video from this channel
        video_res = (
            supabase.table("videos")
            .select("youtube_video_id")
            .eq("channel_id", channel_id)
            .limit(1)
            .execute()
        )

        if not video_res.data:
            print(f"  ⚠ {channel_name}: no videos found, skipping")
            continue

        yt_video_id = video_res.data[0]["youtube_video_id"]
        print(f"  → {channel_name} (via video {yt_video_id})...", end=" ")

        yt_channel_id = fetch_channel_id_from_video(yt_video_id, api_key)
        if not yt_channel_id:
            print("FAILED")
            continue

        # Update the channel
        supabase.table("channels").update(
            {"youtube_channel_id": yt_channel_id}
        ).eq("channel_id", channel_id).execute()

        print(f"✓ {yt_channel_id}")

    print("\n✓ Backfill complete")


if __name__ == "__main__":
    main()
