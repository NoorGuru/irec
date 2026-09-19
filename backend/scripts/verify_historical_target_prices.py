#!/usr/bin/env python3
"""Script to audit and verify historical target prices in Supabase using Jev System One.

Iterates through recommendations with non-null target_price, evaluates them against
the stored video transcript, and:
- Confirms authentic analyst targets (target_price_verified = True)
- Strips ungrounded/hallucinated prices (target_price = None, target_price_verified = False)
"""

import argparse
import asyncio
import logging
import os
import sys
from dotenv import load_dotenv

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv("backend/.env")
load_dotenv(".env")

from supabase import create_client
from app.typesafe_service import (
    is_typesafe_configured,
    score_conviction_and_sentiment,
    slice_transcript_context,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("verify_targets")


async def main():
    parser = argparse.ArgumentParser(description="Audit and verify historical target prices.")
    parser.add_argument("--limit", type=int, default=None, help="Maximum recommendations to process.")
    parser.add_argument("--dry-run", action="store_true", help="Evaluate without modifying database.")
    parser.add_argument("--concurrency", type=int, default=5, help="Number of concurrent Jev evaluations.")
    args = parser.parse_args()

    if not is_typesafe_configured():
        logger.error("TYPESAFE_API_KEY is not configured in environment.")
        sys.exit(1)

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials not configured.")
        sys.exit(1)

    client = create_client(supabase_url, supabase_key)

    logger.info("Fetching recommendations with non-null target_price...")
    query = (
        client.table("recommendations")
        .select("id, video_id, ticker, target_price, quote, catalyst_notes")
        .not_.is_("target_price", "null")
    )
    if args.limit:
        query = query.limit(args.limit)

    resp = query.execute()
    recs = resp.data or []
    logger.info(f"Found {len(recs)} recommendation(s) with target prices to audit.")

    if not recs:
        return

    # Cache video transcripts
    video_ids = list(set(r["video_id"] for r in recs if r.get("video_id")))
    transcripts = {}
    for i in range(0, len(video_ids), 100):
        batch_ids = video_ids[i : i + 100]
        v_resp = client.table("videos").select("video_id, transcript").in_("video_id", batch_ids).execute()
        for v in v_resp.data or []:
            transcripts[v["video_id"]] = v.get("transcript") or ""

    semaphore = asyncio.Semaphore(args.concurrency)
    stats = {
        "total": len(recs),
        "verified": 0,
        "stripped": 0,
        "skipped_no_transcript": 0,
        "errors": 0,
    }

    async def audit_rec(rec):
        vid = rec.get("video_id")
        transcript = transcripts.get(vid)
        if not transcript:
            stats["skipped_no_transcript"] += 1
            return

        tp = float(rec["target_price"])
        ticker = rec["ticker"]

        snippet = slice_transcript_context(
            transcript=transcript,
            quote=rec.get("quote") or "",
            ticker=ticker,
            window_chars=3500,
        )

        async with semaphore:
            try:
                eval_res = await score_conviction_and_sentiment(
                    ticker=ticker,
                    catalyst_notes=rec.get("catalyst_notes") or "",
                    transcript_snippet=snippet,
                    target_price=tp,
                )

                is_verified = eval_res.get("target_price_verified", False)
                status = eval_res.get("target_price_status")
                conf = eval_res.get("target_price_confidence")

                if is_verified:
                    stats["verified"] += 1
                    logger.info(f"[{ticker}] Target ${tp} VERIFIED (status={status}, conf={conf})")
                    if not args.dry_run:
                        client.table("recommendations").update({"target_price_verified": True}).eq("id", rec["id"]).execute()
                else:
                    stats["stripped"] += 1
                    logger.info(f"[{ticker}] Target ${tp} STRIPPED ➔ NULL (status={status}, conf={conf})")
                    if not args.dry_run:
                        client.table("recommendations").update({
                            "target_price": None,
                            "target_price_verified": False,
                        }).eq("id", rec["id"]).execute()

            except Exception as e:
                stats["errors"] += 1
                logger.error(f"Error auditing {ticker} (rec_id={rec['id']}): {e}")

    tasks = [audit_rec(r) for r in recs]
    await asyncio.gather(*tasks)

    logger.info("=" * 50)
    logger.info("AUDIT SUMMARY:")
    logger.info(f"Total evaluated: {stats['total']}")
    logger.info(f"Verified Targets: {stats['verified']}")
    logger.info(f"Stripped False Targets: {stats['stripped']}")
    logger.info(f"Skipped (No Transcript): {stats['skipped_no_transcript']}")
    logger.info(f"Errors: {stats['errors']}")
    if args.dry_run:
        logger.info("DRY RUN: No database changes were written.")
    logger.info("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
