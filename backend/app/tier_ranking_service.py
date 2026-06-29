import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
from app.database import _get_client
from app.today_routes import parse_iso_datetime
from app.stock_ingestion_schemas import RerankResult
from app.ticker_names import TICKER_NAMES

logger = logging.getLogger(__name__)

class TierRankingService:
    """Service to rank tickers and assign ingestion tiers."""

    async def compute_priority_scores(self) -> Dict[str, dict]:
        """Compute priority scores for all tickers based on recommendations."""
        client = _get_client()
        now = datetime.now(timezone.utc)
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        
        # Fetch recommendations for last 30 days
        db_response = (
            client.table("recommendations")
            .select("*, videos!inner(*, channels(*))")
            .gte("videos.published_at", thirty_days_ago)
            .execute()
        )
        
        raw_recs = db_response.data or []
        
        ticker_groups: Dict[str, List[Dict[str, Any]]] = {}
        for rec in raw_recs:
            ticker = rec.get("ticker", "").strip().upper()
            if not ticker: continue
            if ticker not in ticker_groups:
                ticker_groups[ticker] = []
            ticker_groups[ticker].append(rec)
            
        scores = {}
        
        # We need max values to normalize
        max_mentions = max([len(recs) for recs in ticker_groups.values()]) if ticker_groups else 1
        
        max_analysts = 1
        for recs in ticker_groups.values():
            analysts = set([((rec.get("videos") or {}).get("channels") or {}).get("channel_name", "") for rec in recs])
            if len(analysts) > max_analysts:
                max_analysts = len(analysts)

        for ticker, recs in ticker_groups.items():
            mention_count = len(recs)
            analyst_set = set([((rec.get("videos") or {}).get("channels") or {}).get("channel_name", "") for rec in recs])
            analyst_count = len(analyst_set)
            
            norm_mentions = mention_count / max_mentions
            norm_analysts = analyst_count / max_analysts
            
            convictions = [rec.get("conviction_level", 5) for rec in recs]
            avg_conviction = sum(convictions) / len(convictions)
            norm_conviction = avg_conviction / 10.0
            
            sentiments = [rec.get("sentiment", 0) for rec in recs]
            avg_sentiment = sum(sentiments) / len(sentiments)
            abs_sentiment = abs(avg_sentiment) / 2.0  # Sentiment is -2 to 2
            
            # Recency
            latest_pub_date = None
            for rec in recs:
                video = rec.get("videos") or {}
                pub_str = video.get("published_at")
                if pub_str:
                    pub_dt = parse_iso_datetime(pub_str)
                    if latest_pub_date is None or pub_dt > latest_pub_date:
                        latest_pub_date = pub_dt
            
            if latest_pub_date is None:
                latest_pub_date = now - timedelta(days=30)
                
            days_since = (now - latest_pub_date).total_seconds() / 86400.0
            import math
            recency_factor = math.exp(-max(0.0, days_since) / 7.0)
            
            priority_score = (
                0.30 * norm_mentions +
                0.25 * norm_analysts +
                0.20 * norm_conviction +
                0.15 * recency_factor +
                0.10 * abs_sentiment
            )
            
            scores[ticker] = {
                "priority_score": priority_score,
                "mention_count_30d": mention_count,
                "analyst_count": analyst_count,
                "last_mentioned_at": latest_pub_date.isoformat()
            }
            
        return scores

    async def refresh_stock_meta_tiers(self, max_tier1: int = 50) -> RerankResult:
        """Rerank all tickers and update tiers."""
        scores = await self.compute_priority_scores()
        client = _get_client()
        
        # Get existing meta
        existing_res = client.table("stock_meta").select("*").execute()
        existing_meta = {row["ticker"]: row for row in (existing_res.data or [])}
        
        # Ensure all known tickers exist in meta
        for ticker in TICKER_NAMES.keys():
            if ticker not in existing_meta:
                existing_meta[ticker] = {
                    "ticker": ticker,
                    "tier": 2,
                    "is_pinned": False,
                    "priority_score": 0.0,
                    "mention_count_30d": 0,
                    "analyst_count": 0,
                    "last_mentioned_at": None
                }
                
        # Merge scores
        for ticker, score_data in scores.items():
            if ticker not in existing_meta:
                existing_meta[ticker] = {
                    "ticker": ticker,
                    "tier": 2,
                    "is_pinned": False,
                    "priority_score": 0.0,
                    "mention_count_30d": 0,
                    "analyst_count": 0,
                    "last_mentioned_at": None
                }
            existing_meta[ticker].update(score_data)
            
        # Add tickers that have existing meta but no recent scores
        all_tickers = list(existing_meta.values())
        
        # Identify pinned
        pinned_tickers = [t for t in all_tickers if t.get("is_pinned", False)]
        pinned_symbols = [t["ticker"] for t in pinned_tickers]
        
        # Identify dynamic
        unpinned_tickers = [t for t in all_tickers if not t.get("is_pinned", False)]
        unpinned_tickers.sort(key=lambda x: x.get("priority_score", 0.0), reverse=True)
        
        dynamic_slots = max(0, max_tier1 - len(pinned_tickers))
        dynamic_tier1 = unpinned_tickers[:dynamic_slots]
        tier2_tickers = unpinned_tickers[dynamic_slots:]
        
        promoted = []
        demoted = []
        
        # Prepare updates
        updates = []
        for t in pinned_tickers:
            if t.get("tier") != 1: promoted.append(t["ticker"])
            t["tier"] = 1
            updates.append(t)
            
        for t in dynamic_tier1:
            if t.get("tier") != 1: promoted.append(t["ticker"])
            t["tier"] = 1
            updates.append(t)
            
        for t in tier2_tickers:
            if t.get("tier") != 2: demoted.append(t["ticker"])
            t["tier"] = 2
            updates.append(t)
            
        # Upsert to DB
        if updates:
            # Upsert in chunks to avoid size limits
            for i in range(0, len(updates), 100):
                batch = updates[i:i+100]
                client.table("stock_meta").upsert(batch).execute()
                
        # Log run
        client.table("ingestion_log").insert({
            "run_type": "tier_rerank",
            "status": "success",
            "metadata": {
                "promoted": promoted,
                "demoted": demoted,
                "pinned_count": len(pinned_tickers)
            }
        }).execute()
        
        return RerankResult(promoted=promoted, demoted=demoted, pinned=pinned_symbols)
