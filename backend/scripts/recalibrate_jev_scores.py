#!/usr/bin/env python3
"""Recalibrate historical recommendations with the speech-act Jev conviction rubric.

Re-scores existing recommendations via score_recommendations_batch (never drops stocks).
Prints before/after conviction_score distribution. Use --dry-run to evaluate without writes.

Usage:
  python backend/scripts/recalibrate_jev_scores.py --dry-run --limit 100
  python backend/scripts/recalibrate_jev_scores.py --limit 500 --concurrency 5
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import statistics
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv("backend/.env")
load_dotenv(".env")

from supabase import create_client

from app.schemas import Recommendation
from app.typesafe_service import is_typesafe_configured, score_recommendations_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("recalibrate_jev")


def _summarize(scores: list[float], label: str) -> None:
    if not scores:
        logger.info("%s: no scores", label)
        return
    scores_sorted = sorted(scores)
    n = len(scores_sorted)
    p50 = scores_sorted[n // 2]
    p90 = scores_sorted[int(n * 0.9)] if n > 1 else scores_sorted[0]
    below_10 = sum(1 for s in scores if s < 10) / n * 100
    above_70 = sum(1 for s in scores if s >= 70) / n * 100
    logger.info(
        "%s n=%d mean=%.1f median=%.1f p90=%.1f <10=%.1f%% >=70=%.1f%%",
        label,
        n,
        statistics.mean(scores),
        p50,
        p90,
        below_10,
        above_70,
    )


async def _recalibrate_video(
    client,
    video: dict,
    raw_recs: list[dict],
    dry_run: bool,
    semaphore: asyncio.Semaphore,
) -> tuple[list[float], list[float]]:
    async with semaphore:
        before = [
            float(r["conviction_score"])
            if r.get("conviction_score") is not None
            else float(r.get("conviction_level") or 5) * 10.0
            for r in raw_recs
        ]

        recommendations: list[Recommendation] = []
        for r in raw_recs:
            initial_conv = r.get("initial_conviction_level")
            initial_sent = r.get("initial_sentiment")
            working_conv = initial_conv if initial_conv is not None else r.get("conviction_level", 5)
            working_sent = initial_sent if initial_sent is not None else r.get("sentiment", 0)
            recommendations.append(
                Recommendation(
                    ticker=r["ticker"],
                    stock_name=r.get("stock_name") or "",
                    sentiment=working_sent,
                    target_price=r.get("target_price"),
                    conviction_level=working_conv,
                    catalyst_notes=r.get("catalyst_notes") or "n/a",
                    quote=r.get("quote") or "",
                    initial_conviction_level=initial_conv,
                    initial_sentiment=initial_sent,
                    target_price_verified=r.get("target_price_verified"),
                    is_verified=r.get("is_verified"),
                )
            )

        channels = video.get("channels") or {}
        channel_name = (channels.get("channel_name") or "") if isinstance(channels, dict) else ""
        calibrated = await score_recommendations_batch(
            recommendations,
            video.get("transcript") or "",
            video_title=video.get("title") or "",
            channel_name=channel_name,
        )
        after = [float(r.conviction_score if r.conviction_score is not None else r.conviction_level * 10) for r in calibrated]

        if not dry_run:
            # Update rows in place by ticker (same video)
            for rec in calibrated:
                matching = [r for r in raw_recs if r["ticker"] == rec.ticker]
                if not matching:
                    continue
                row_id = matching[0].get("id")
                payload = {
                    "conviction_score": rec.conviction_score,
                    "conviction_confidence": rec.conviction_confidence,
                    "conviction_level": rec.conviction_level,
                    "sentiment_score": rec.sentiment_score,
                    "sentiment_confidence": rec.sentiment_confidence,
                    "sentiment": rec.sentiment,
                    "is_verified": rec.is_verified,
                    "target_price_verified": rec.target_price_verified,
                    "target_price": rec.target_price,
                }
                if rec.initial_conviction_level is not None:
                    payload["initial_conviction_level"] = rec.initial_conviction_level
                if rec.initial_sentiment is not None:
                    payload["initial_sentiment"] = rec.initial_sentiment
                if row_id:
                    client.table("recommendations").update(payload).eq("id", row_id).execute()

        return before, after


async def main() -> None:
    parser = argparse.ArgumentParser(description="Recalibrate Jev conviction/sentiment scores.")
    parser.add_argument("--limit", type=int, default=None, help="Max videos to process.")
    parser.add_argument("--dry-run", action="store_true", help="Score without writing to DB.")
    parser.add_argument("--concurrency", type=int, default=3, help="Concurrent video recalibrations.")
    args = parser.parse_args()

    if not is_typesafe_configured():
        logger.error("TYPESAFE_API_KEY / ENABLE_TYPESAFE_SCORING not configured.")
        sys.exit(1)

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials not configured.")
        sys.exit(1)

    client = create_client(supabase_url, supabase_key)

    logger.info("Fetching videos with transcripts...")
    query = (
        client.table("videos")
        .select("video_id, title, transcript, channels(channel_name)")
        .not_.is_("transcript", "null")
        .order("published_at", desc=True)
    )
    if args.limit:
        query = query.limit(args.limit)
    videos = query.execute().data or []
    logger.info("Found %d video(s). dry_run=%s", len(videos), args.dry_run)

    # Load recommendations per video
    video_ids = [v["video_id"] for v in videos]
    recs_by_video: dict[str, list] = {vid: [] for vid in video_ids}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        resp = (
            client.table("recommendations")
            .select("*")
            .in_("video_id", batch)
            .execute()
        )
        for r in resp.data or []:
            recs_by_video.setdefault(r["video_id"], []).append(r)

    semaphore = asyncio.Semaphore(args.concurrency)
    before_all: list[float] = []
    after_all: list[float] = []

    tasks = []
    for video in videos:
        raw = recs_by_video.get(video["video_id"]) or []
        if not raw:
            continue
        tasks.append(_recalibrate_video(client, video, raw, args.dry_run, semaphore))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for res in results:
        if isinstance(res, Exception):
            logger.warning("Video recalibration failed: %s", res)
            continue
        before, after = res
        before_all.extend(before)
        after_all.extend(after)

    _summarize(before_all, "BEFORE")
    _summarize(after_all, "AFTER")
    if args.dry_run:
        logger.info("Dry run complete — no database writes.")
    else:
        logger.info("Wrote recalibrated scores for %d recommendation(s).", len(after_all))


if __name__ == "__main__":
    asyncio.run(main())
