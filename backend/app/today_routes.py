"""Today's Plays API router for Aura.

Computes a composite Action Score (0-100) per ticker based on sentiment,
conviction, analyst agreement, recency, and momentum over a 30-day window.
"""

import logging
import math
import statistics
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.database import _get_client, get_cache, set_cache, get_latest_extraction_time

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1",
    tags=["today"],
)

# --- Schemas ---

class VideoSummaryInfo(BaseModel):
    youtube_video_id: str
    channel_name: str
    published_at: str

class CatalystOpinion(BaseModel):
    channel_name: str
    sentiment: int
    conviction: int
    notes: str
    published_at: str
    youtube_video_id: str

class PlayResponse(BaseModel):
    ticker: str
    stock_name: str
    direction: str  # "BUY" or "SELL"
    action_score: int  # 0 to 100
    action_label: str  # "Strong Buy", "Buy", "Sell", "Strong Sell"
    consensus_sentiment: float
    avg_conviction: float
    avg_target_price: Optional[float] = None
    recent_mentions: int
    analyst_count: int
    agreement_pct: int
    top_catalyst: str
    catalysts: List[CatalystOpinion]
    why_bullets: List[str]
    latest_video: VideoSummaryInfo

class MarketMoodResponse(BaseModel):
    buy_plays: int
    sell_plays: int
    overall: str  # "Bullish", "Bearish", "Neutral"

class TodayPlaysResponse(BaseModel):
    generated_at: str
    plays: List[PlayResponse]
    market_mood: MarketMoodResponse

# --- Helper Functions ---

def parse_iso_datetime(dt_str: str) -> datetime:
    """Parse ISO datetime string, supporting both 'Z' and offset formats."""
    if not dt_str:
        return datetime.now(timezone.utc)
    try:
        # Replace Z with +00:00 to make it datetime.fromisoformat compatible
        if dt_str.endswith("Z"):
            dt_str = dt_str[:-1] + "+00:00"
        return datetime.fromisoformat(dt_str)
    except Exception as e:
        logger.warning(f"Failed to parse datetime {dt_str}: {e}")
        return datetime.now(timezone.utc)

# --- API Route ---

@router.get("/today", response_model=TodayPlaysResponse)
async def get_today_plays(
    days: int = Query(30, ge=1, le=90, description="Window of recommendations in days")
):
    """Retrieve top stock plays right now sorted by Action Score."""
    try:
        # Check cache first
        cache_key = f"today_plays_{days}"
        cached_data = await get_cache(cache_key)
        latest_extraction = await get_latest_extraction_time()

        if cached_data and latest_extraction:
            cache_updated = parse_iso_datetime(cached_data.get("last_updated"))
            latest_ext_dt = parse_iso_datetime(latest_extraction)
            
            # If cache is newer than or equal to latest video extraction, use cache
            if cache_updated >= latest_ext_dt:
                logger.info("Serving Today's Plays from database cache")
                return cached_data["payload"]

        # Cache miss or stale -> calculate
        client = _get_client()
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=days)).isoformat()

        # Query all recommendations within the timeframe
        # Inner join on videos table to filter by published_at
        response = (
            client.table("recommendations")
            .select("*, videos!inner(*, channels(*))")
            .gte("videos.published_at", start_date)
            .execute()
        )

        raw_recs = response.data or []
        
        # Group recommendations by ticker
        ticker_groups: Dict[str, List[Dict[str, Any]]] = {}
        for rec in raw_recs:
            ticker = rec.get("ticker", "").strip().upper()
            if not ticker:
                continue
            if ticker not in ticker_groups:
                ticker_groups[ticker] = []
            ticker_groups[ticker].append(rec)

        plays: List[PlayResponse] = []

        # Process each ticker
        for ticker, recs in ticker_groups.items():
            # Apply filter: Must have >=2 recommendations within the 30-day window
            if len(recs) < 2:
                continue

            stock_name = recs[0].get("stock_name") or ticker

            # 1. Consensus Sentiment
            # Calculate trust-weighted average sentiment
            total_weight = 0.0
            weighted_sentiment_sum = 0.0
            sentiments = []
            convictions = []
            target_prices = []

            for rec in recs:
                sentiment = rec.get("sentiment", 0)
                sentiments.append(sentiment)
                
                conviction = rec.get("conviction_level", 5)
                convictions.append(conviction)

                t_price = rec.get("target_price")
                if t_price is not None:
                    target_prices.append(float(t_price))

                video = rec.get("videos") or {}
                channel = video.get("channels") or {}
                # trust_weight defaults to 1.0 if not specified
                trust_weight = channel.get("trust_weight")
                if trust_weight is None:
                    trust_weight = 1.0
                
                total_weight += trust_weight
                weighted_sentiment_sum += sentiment * trust_weight

            consensus_sentiment = (
                weighted_sentiment_sum / total_weight if total_weight > 0 else sum(sentiments) / len(sentiments)
            )

            # Consensus direction
            direction = "BUY" if consensus_sentiment >= 0 else "SELL"

            # 2. Avg Conviction
            avg_conviction = sum(convictions) / len(convictions)

            # 3. Agreement Score
            # Measure standard deviation. Max stddev for sentiment range [-2, 2] is 2.0.
            if len(sentiments) > 1:
                stddev = statistics.pstdev(sentiments)
            else:
                stddev = 0.0
            # agreement = 1 - (stddev / 2.0), mapped to 0-100
            agreement_pct = int(max(0, min(1, 1.0 - (stddev / 2.0))) * 100)

            # 4. Recency Score
            # Use the most recent video's published_at date
            latest_rec = None
            latest_pub_date = None
            for rec in recs:
                video = rec.get("videos") or {}
                pub_str = video.get("published_at")
                if pub_str:
                    pub_dt = parse_iso_datetime(pub_str)
                    if latest_pub_date is None or pub_dt > latest_pub_date:
                        latest_pub_date = pub_dt
                        latest_rec = rec

            if latest_pub_date is None:
                latest_pub_date = now - timedelta(days=days) # fallback
                latest_rec = recs[0]

            days_since_latest = (now - latest_pub_date).total_seconds() / 86400.0
            # Exponential decay: e^(-days/7) * 100
            recency_score = math.exp(-max(0.0, days_since_latest) / 7.0) * 100.0

            # 5. Momentum Score
            # Compare last 7 days vs older (day 8 to 30)
            seven_days_ago = now - timedelta(days=7)
            recent_sentiments = []
            older_sentiments = []

            for rec in recs:
                video = rec.get("videos") or {}
                pub_str = video.get("published_at")
                if pub_str:
                    pub_dt = parse_iso_datetime(pub_str)
                    if pub_dt >= seven_days_ago:
                        recent_sentiments.append(rec.get("sentiment", 0))
                    else:
                        older_sentiments.append(rec.get("sentiment", 0))

            direction_sign = 1 if consensus_sentiment >= 0 else -1
            if recent_sentiments and older_sentiments:
                avg_recent = sum(recent_sentiments) / len(recent_sentiments)
                avg_older = sum(older_sentiments) / len(older_sentiments)
                delta = (avg_recent - avg_older) * direction_sign
                # Max delta is 4 (e.g. from -2 to +2). Map -4..+4 to 0..100.
                momentum_score = 50.0 + (delta / 4.0) * 50.0
            elif recent_sentiments:
                # All recommendations are fresh (last 7 days) -> positive momentum
                momentum_score = 75.0
            else:
                # All recommendations are older -> negative momentum
                momentum_score = 25.0

            # --- Calculate Composite Action Score ---
            # Weights: Sentiment 25%, Conviction 20%, Agreement 20%, Recency 20%, Momentum 15%
            # Sentiment score is abs(consensus_sentiment)/2.0 * 100.0 (range 0-100)
            sentiment_score = (abs(consensus_sentiment) / 2.0) * 100.0
            conviction_score = avg_conviction * 10.0 # conviction level is 1-10

            action_score_raw = (
                0.25 * sentiment_score +
                0.20 * conviction_score +
                0.20 * agreement_pct +
                0.20 * recency_score +
                0.15 * momentum_score
            )
            action_score = int(max(0, min(100, action_score_raw)))

            # --- Aggressive Filtering ---
            # Stricter criteria: Only return plays with Action Score >= 60
            if action_score < 60:
                continue

            # --- Determine Action Label ---
            if action_score >= 80:
                action_label = "Strong Buy" if direction == "BUY" else "Strong Sell"
            else:
                action_label = "Buy" if direction == "BUY" else "Sell"

            # --- Generate Why Bullets ---
            # Recent mentions count
            recent_mentions = len(recent_sentiments)
            
            why_bullets = []
            # Bullet 1: Mentions and recency
            if recent_mentions > 0:
                why_bullets.append(f"{recent_mentions} mention{'s' if recent_mentions > 1 else ''} this week")
            else:
                why_bullets.append(f"{len(recs)} mention{'s' if len(recs) > 1 else ''} in the last {days} days")

            # Bullet 2: Analyst agreement
            analyst_names = list(set([
                ((rec.get("videos") or {}).get("channels") or {}).get("channel_name", "Unknown Analyst")
                for rec in recs
            ]))
            analyst_count = len(analyst_names)
            
            if agreement_pct >= 85 and analyst_count >= 2:
                why_bullets.append(f"{analyst_count} analysts agree — consensus is {direction.lower()}ish")
            elif agreement_pct < 60:
                why_bullets.append(f"Mixed consensus ({agreement_pct}% analyst agreement)")
            else:
                why_bullets.append(f"{analyst_count} independent analyst{'s' if analyst_count > 1 else ''} tracked")

            # Bullet 3: Conviction
            if avg_conviction >= 8.0:
                why_bullets.append(f"Very high average conviction ({avg_conviction:.1f}/10)")
            elif avg_conviction >= 6.5:
                why_bullets.append(f"Strong conviction ({avg_conviction:.1f}/10)")
            else:
                why_bullets.append(f"Moderate conviction ({avg_conviction:.1f}/10)")

            # --- Catalysts list & Top Catalyst ---
            # Sort recommendations by conviction descending to get the top opinions first
            sorted_recs = sorted(recs, key=lambda x: (x.get("conviction_level", 0)), reverse=True)
            
            catalysts_list: List[CatalystOpinion] = []
            for r in sorted_recs:
                notes = r.get("catalyst_notes", "").strip()
                if not notes:
                    continue
                v_obj = r.get("videos") or {}
                c_obj = v_obj.get("channels") or {}
                catalysts_list.append(CatalystOpinion(
                    channel_name=c_obj.get("channel_name", "Unknown Analyst"),
                    sentiment=r.get("sentiment", 0),
                    conviction=r.get("conviction_level", 5),
                    notes=notes,
                    published_at=v_obj.get("published_at", ""),
                    youtube_video_id=v_obj.get("youtube_video_id", "")
                ))

            top_rec = sorted_recs[0]
            top_catalyst = top_rec.get("catalyst_notes") or "No catalyst notes available."

            avg_target = sum(target_prices) / len(target_prices) if target_prices else None

            # Get video details for the latest_rec
            latest_video_obj = latest_rec.get("videos") or {}
            latest_channel_obj = latest_video_obj.get("channels") or {}
            
            latest_video_info = VideoSummaryInfo(
                youtube_video_id=latest_video_obj.get("youtube_video_id", ""),
                channel_name=latest_channel_obj.get("channel_name", "Unknown Channel"),
                published_at=latest_video_obj.get("published_at", "")
            )

            plays.append(
                PlayResponse(
                    ticker=ticker,
                    stock_name=stock_name,
                    direction=direction,
                    action_score=action_score,
                    action_label=action_label,
                    consensus_sentiment=round(consensus_sentiment, 2),
                    avg_conviction=round(avg_conviction, 1),
                    avg_target_price=round(avg_target, 2) if avg_target is not None else None,
                    recent_mentions=recent_mentions,
                    analyst_count=analyst_count,
                    agreement_pct=agreement_pct,
                    top_catalyst=top_catalyst,
                    catalysts=catalysts_list,
                    why_bullets=why_bullets[:3],
                    latest_video=latest_video_info
                )
            )

        # Sort plays: highest Action Score first
        plays.sort(key=lambda x: x.action_score, reverse=True)

        # Compute Market Mood
        buy_plays = sum(1 for p in plays if p.direction == "BUY")
        sell_plays = sum(1 for p in plays if p.direction == "SELL")
        
        if buy_plays > sell_plays * 1.5:
            overall_mood = "Bullish"
        elif sell_plays > buy_plays * 1.5:
            overall_mood = "Bearish"
        else:
            overall_mood = "Neutral"

        market_mood = MarketMoodResponse(
            buy_plays=buy_plays,
            sell_plays=sell_plays,
            overall=overall_mood
        )

        result = TodayPlaysResponse(
            generated_at=now.isoformat(),
            plays=plays,
            market_mood=market_mood
        )

        # Save to database cache
        await set_cache(cache_key, result.dict())

        return result

    except Exception as e:
        logger.error(f"Error calculating today's plays: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating today's plays: {str(e)}"
        )
