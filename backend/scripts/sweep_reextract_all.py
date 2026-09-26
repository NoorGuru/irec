"""Sweep and re-extract all videos ingested since Jev was added (Sep 19, 2026).

Restores any recommendations dropped by the previous brittle context slicing bug
and recalibrates all continuous conviction and sentiment scores.
"""

import asyncio
import json
import logging
import os
import sys
import time

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import _get_client, replace_recommendations
from app.llm_parser import parse_recommendations
from app.metadata import fetch_metadata
from app.schemas import VideoMetadata

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sweep_reextract")

# Already fixed and verified
ALREADY_FIXED = {
    "ghcrWbGGJDk",  # Apple/Meta New Tech (4 recs)
    "qnhZxRrFN-Y",  # 4 High Short Interest (4 recs)
    "bGhRAjwTusg",  # Bulletproof AI Stocks (8 recs)
    "bzZbq8NlWwo",  # 5 'Dying' Stocks (5 recs - added BlackBerry)
    "3tovfL0sdyM",  # Warren Buffett AI Bubble (5 recs)
}


async def process_video(client, video_record: dict, idx: int, total: int) -> dict:
    video_id = video_record["video_id"]
    yid = video_record["youtube_video_id"]
    title = video_record.get("title") or "Untitled"
    transcript = video_record.get("transcript") or ""

    print(f"\n[{idx}/{total}] Processing video: {yid} | '{title[:60]}...'")

    if not transcript:
        print(f"  [SKIP] Video {yid} has no transcript in database.")
        return {"yid": yid, "status": "skipped_no_transcript"}

    # 1. Fetch before state
    before_recs_resp = client.table("recommendations").select("ticker, stock_name").eq("video_id", video_id).execute()
    before_tickers = [r["ticker"] for r in (before_recs_resp.data or [])]
    print(f"  Current DB recs ({len(before_tickers)}): {before_tickers}")

    # 2. Get metadata (try YouTube API, fallback to DB)
    try:
        metadata = await fetch_metadata(yid)
    except Exception as e:
        logger.warning(f"Could not fetch metadata from YouTube API for {yid}: {e}. Falling back to DB record.")
        ch_name = "Unknown Channel"
        if video_record.get("channels") and isinstance(video_record["channels"], dict):
            ch_name = video_record["channels"].get("channel_name") or ch_name
        metadata = VideoMetadata(
            channel_name=ch_name,
            published_at=video_record.get("published_at") or "",
            title=video_record.get("title") or "",
            duration=video_record.get("duration") or "",
        )

    # 3. Call parse_recommendations with retry
    max_retries = 3
    recs = []
    summary = ""
    for attempt in range(max_retries):
        try:
            recs, summary = await parse_recommendations(transcript, metadata)
            break
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                wait_sec = 2 ** (attempt + 1) * 2
                print(f"  [WAIT] Rate limited on attempt {attempt+1}, sleeping {wait_sec}s...")
                await asyncio.sleep(wait_sec)
            else:
                if attempt == max_retries - 1:
                    print(f"  [ERROR] Failed to parse recommendations for {yid}: {e}")
                    return {"yid": yid, "status": "error", "error": str(e)}
                await asyncio.sleep(2)

    after_tickers = [r.ticker for r in recs]
    diff = len(after_tickers) - len(before_tickers)
    added_tickers = [t for t in after_tickers if t not in before_tickers]

    # 4. Replace in database
    await replace_recommendations(
        video_id=video_id,
        recommendations=recs,
        video_summary=summary,
        title=metadata.title or title,
        duration=metadata.duration or video_record.get("duration"),
    )

    if diff > 0 or added_tickers:
        print(f"  🎉 RECOVERED {diff:+d} recommendations! New recs ({len(after_tickers)}): {after_tickers} (Added: {added_tickers})")
    elif diff < 0:
        print(f"  ⚠️ Rec count changed: {len(before_tickers)} -> {len(after_tickers)}: {after_tickers}")
    else:
        print(f"  ✅ Kept all {len(after_tickers)} recs with refreshed continuous scoring: {after_tickers}")

    # Brief delay to respect external rate limits
    await asyncio.sleep(1.5)

    return {
        "yid": yid,
        "title": title,
        "status": "success",
        "before_count": len(before_tickers),
        "after_count": len(after_tickers),
        "before_tickers": before_tickers,
        "after_tickers": after_tickers,
        "added_tickers": added_tickers,
    }


async def main():
    client = _get_client()

    print("=================================================================")
    print("Starting Comprehensive Ingestion Recovery Sweep (Sep 19 - Sep 26)")
    print("=================================================================")

    # Query all videos since Sep 19
    resp = (
        client.table("videos")
        .select("video_id, youtube_video_id, title, published_at, duration, transcript, extracted_at, channels(channel_name)")
        .gte("extracted_at", "2026-09-19T00:00:00Z")
        .order("extracted_at", desc=False)
        .execute()
    )
    all_videos = resp.data or []
    print(f"Total videos in window: {len(all_videos)}")

    to_process = [v for v in all_videos if v["youtube_video_id"] not in ALREADY_FIXED]
    print(f"Videos to process: {len(to_process)} (Skipping {len(ALREADY_FIXED)} already fixed)")

    results = []
    total_added = 0
    total_before = 0
    total_after = 0

    for i, v in enumerate(to_process, 1):
        res = await process_video(client, v, i, len(to_process))
        results.append(res)
        if res.get("status") == "success":
            total_before += res["before_count"]
            total_after += res["after_count"]
            if res.get("added_tickers"):
                total_added += len(res["added_tickers"])

    # Write results summary
    out_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "sweep_results.json"))
    summary_data = {
        "timestamp": time.time(),
        "total_processed": len(to_process),
        "total_before_recs": total_before,
        "total_after_recs": total_after,
        "total_new_recs_recovered": total_after - total_before,
        "results": results,
    }
    with open(out_file, "w") as f:
        json.dump(summary_data, f, indent=2)

    print("\n=================================================================")
    print("Sweep Complete Summary:")
    print(f"  Total videos processed: {len(to_process)}")
    print(f"  Total recommendations before: {total_before}")
    print(f"  Total recommendations after:  {total_after}")
    print(f"  Net new recommendations recovered: {total_after - total_before:+d}")
    print(f"  Summary saved to: {out_file}")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(main())
