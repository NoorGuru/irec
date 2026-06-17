"""Backfill video titles for existing videos.

Uses the YouTube Data API v3 to fetch titles in batches of 50.

Usage:
    cd backend
    python -m scripts.backfill_video_titles

Requires: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY in .env
"""

import os
import sys

import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"
BATCH_SIZE = 50  # YouTube API max per request


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    base_url = url.rstrip("/").replace("/rest/v1", "")
    return create_client(base_url, key)


def fetch_titles_batch(
    video_ids: list[str], api_key: str
) -> dict[str, str]:
    """Fetch titles for up to 50 video IDs in one API call."""
    params = {
        "part": "snippet",
        "id": ",".join(video_ids),
        "key": api_key,
    }
    try:
        resp = httpx.get(YOUTUBE_API_URL, params=params, timeout=15.0)
        resp.raise_for_status()
        items = resp.json().get("items", [])
        return {item["id"]: item["snippet"]["title"] for item in items}
    except Exception as e:
        print(f"  ⚠ API error: {e}")
        return {}


def main():
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        print("Error: YOUTUBE_API_KEY not set")
        sys.exit(1)

    supabase = get_supabase()

    # Get videos missing title
    videos_res = (
        supabase.table("videos")
        .select("video_id, youtube_video_id, title")
        .is_("title", "null")
        .execute()
    )
    videos = videos_res.data or []

    if not videos:
        print("✓ All videos already have titles")
        return

    print(f"Found {len(videos)} video(s) missing titles\n")

    updated = 0
    failed = 0

    # Process in batches of 50
    for i in range(0, len(videos), BATCH_SIZE):
        batch = videos[i : i + BATCH_SIZE]
        yt_ids = [v["youtube_video_id"] for v in batch]

        print(f"  Batch {i // BATCH_SIZE + 1}: fetching {len(yt_ids)} titles...")
        titles = fetch_titles_batch(yt_ids, api_key)

        for v in batch:
            yt_id = v["youtube_video_id"]
            title = titles.get(yt_id)

            if title:
                supabase.table("videos").update({"title": title}).eq(
                    "video_id", v["video_id"]
                ).execute()
                print(f"    ✓ {yt_id}: {title[:60]}")
                updated += 1
            else:
                print(f"    ✗ {yt_id}: not found")
                failed += 1

    print(f"\n✓ Backfill complete: {updated} updated, {failed} failed")


if __name__ == "__main__":
    main()
