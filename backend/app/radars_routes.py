import logging
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Response
import statistics

from app.database import get_cache, set_cache, get_latest_extraction_time
from app.radars_schemas import RadarDefinition, RadarResponse, RadarTrendPoint
from app.today_routes import calculate_today_plays, parse_iso_datetime
from app.ticker_names import lookup_stock_name

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/radars",
    tags=["radars"],
)

# Fetch Radars from DB dynamically
async def get_radars_from_db() -> List[RadarDefinition]:
    from app.database import _get_client
    client = _get_client()

    # Fetch radars
    radars_res = client.table("radars").select("*").execute()
    if not radars_res.data:
        return []

    radars_data = radars_res.data

    # Fetch all tickers
    tickers_res = client.table("radar_tickers").select("*").execute()
    tickers_map = {}
    for row in tickers_res.data:
        rid = row["radar_id"]
        if rid not in tickers_map:
            tickers_map[rid] = []
        tickers_map[rid].append(row["ticker"])

    # Map slugs to categories
    slug_to_category = {
        "mag-7": "Tech & Innovation",
        "mangos": "Tech & Innovation",
        "ai-infrastructure": "Tech & Innovation",
        "glp-1": "Healthcare",
        "crypto-proxies": "Finance",
        "defense": "Defense",
        "ai-semiconductors": "Tech & Innovation",
        "cloud-computing": "Tech & Innovation",
        "renewable-energy": "Energy",
        "dividend-aristocrats": "Dividend Aristocrats",
        "fintech": "Finance",
        "emerging-markets": "Emerging Markets",
        "cybersecurity": "Tech & Innovation",
        "space-technology": "Space Technology",
    }

    radar_defs = []
    for r in radars_data:
        rid = r["id"]
        tickers = tickers_map.get(rid, [])
        radar_defs.append(RadarDefinition(
            name=r["name"],
            slug=r["slug"],
            description=r.get("description", ""),
            theme_color=r.get("theme_color", "#00D4AA"),
            icon=r.get("icon", "activity"),
            tickers=tickers,
            category=slug_to_category.get(r["slug"], "Other"),
        ))

    return radar_defs

async def get_radar_history(radar_slug: str) -> List[RadarTrendPoint]:
    """Fetch the historical daily snapshots for a radar."""
    from app.database import _get_client
    client = _get_client()
    
    # First get the radar ID
    r_res = client.table("radars").select("id").eq("slug", radar_slug).execute()
    if not r_res.data:
        return []
        
    radar_id = r_res.data[0]["id"]
    
    # Fetch history for last 30 days
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    hist_res = (
        client.table("radar_history")
        .select("*")
        .eq("radar_id", radar_id)
        .gte("date", thirty_days_ago)
        .order("date", desc=False)
        .execute()
    )
    
    trend = []
    for row in hist_res.data:
        trend.append(RadarTrendPoint(
            date=row["date"],
            aura_score=row["aura_score"]
        ))
        
    return trend


async def get_radar_plays_data() -> dict:
    """Fetch minimal play data needed for radar computation."""
    cache_key = "radar_plays_data_v4"

    cached_data = await get_cache(cache_key)
    latest_extraction = await get_latest_extraction_time()

    if cached_data and latest_extraction:
        cache_updated = parse_iso_datetime(cached_data.get("last_updated"))
        latest_ext_dt = parse_iso_datetime(latest_extraction)

        if cache_updated >= latest_ext_dt:
            return cached_data["payload"]

    # Cache miss or stale -> fetch minimal data from database
    from app.database import _get_client
    client = _get_client()
    days = 30
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()

    # Fetch recommendations with minimal fields for all time
    db_response = (
        client.table("recommendations")
        .select("ticker, target_price, sentiment, conviction_level, catalyst_notes, videos!inner(published_at, channels!inner(channel_name, trust_weight))")
        .execute()
    )

    all_raw_recs = db_response.data or []

    # Group by ticker
    ticker_groups: Dict[str, List[Dict[str, Any]]] = {}
    for rec in all_raw_recs:
        ticker = rec.get("ticker", "").strip().upper()
        if not ticker:
            continue
        if ticker not in ticker_groups:
            ticker_groups[ticker] = []
        ticker_groups[ticker].append(rec)

    plays = []
    for ticker, all_recs in ticker_groups.items():
        # Separate recent from all-time
        recent_recs = [r for r in all_recs if r.get("videos", {}).get("published_at", "") >= start_date]
        recent_mentions = len(recent_recs)
        
        analyst_count = len(set([(r.get("videos") or {}).get("channels", {}).get("channel_name", "Unknown") for r in all_recs]))

        sentiments = [r.get("sentiment", 0) for r in all_recs]
        convictions = [r.get("conviction_level", 5) for r in all_recs]
        target_prices = [float(r.get("target_price")) for r in all_recs if r.get("target_price") is not None]

        avg_conviction = sum(convictions) / len(convictions) if all_recs else 0.0
        avg_target_price = sum(target_prices) / len(target_prices) if target_prices else None

        # Calculate trust-weighted consensus sentiment
        total_weight = 0.0
        weighted_sentiment_sum = 0.0
        for rec in all_recs:
            sentiment = rec.get("sentiment", 0)
            channel = (rec.get("videos") or {}).get("channels") or {}
            trust_weight = channel.get("trust_weight") or 1.0
            total_weight += trust_weight
            weighted_sentiment_sum += sentiment * trust_weight

        consensus_sentiment = weighted_sentiment_sum / total_weight if total_weight > 0 else 0.0

        # Omni score uses all time data roughly
        omni_score = int(50 + (consensus_sentiment * 25))
        
        # Aura score uses recent data
        if recent_recs:
            recent_weight = 0.0
            recent_sent_sum = 0.0
            for rec in recent_recs:
                sentiment = rec.get("sentiment", 0)
                channel = (rec.get("videos") or {}).get("channels") or {}
                trust_weight = channel.get("trust_weight") or 1.0
                recent_weight += trust_weight
                recent_sent_sum += sentiment * trust_weight
            recent_consensus = recent_sent_sum / recent_weight if recent_weight > 0 else 0.0
            aura_score = int(50 + (recent_consensus * 25))
        else:
            aura_score = 0

        if len(sentiments) > 1:
            stddev = statistics.pstdev(sentiments)
        else:
            stddev = 0.0
        agreement_pct = int(max(0, min(1, 1.0 - (stddev / 2.0))) * 100)

        direction = "BUY" if consensus_sentiment >= 0 else "SELL"
        if omni_score >= 80:
            action_label = "Strong Buy" if direction == "BUY" else "Strong Sell"
        else:
            action_label = "Buy" if direction == "BUY" else "Sell"

        sorted_recs = sorted(all_recs, key=lambda x: x.get("conviction_level", 5), reverse=True)
        top_catalyst = sorted_recs[0].get("catalyst_notes") if sorted_recs else None
        if not top_catalyst:
            top_catalyst = "No catalyst notes available."

        latest_mention_date = max([r.get("videos", {}).get("published_at", "") for r in all_recs]) if all_recs else None

        plays.append({
            "ticker": ticker,
            "stock_name": lookup_stock_name(ticker),
            "aura_score": aura_score,
            "omni_score": omni_score,
            "recent_mentions": recent_mentions,
            "analyst_count": analyst_count,
            "avg_conviction": avg_conviction,
            "consensus_sentiment": consensus_sentiment,
            "avg_target_price": avg_target_price,
            "agreement_pct": agreement_pct,
            "action_label": action_label,
            "top_catalyst": top_catalyst,
            "latest_mention_date": latest_mention_date
        })

    # Inject latest stock prices
    if plays:
        play_tickers = [p["ticker"] for p in plays]
        five_days_ago = (now - timedelta(days=5)).isoformat()
        try:
            prices_res = client.table("stock_prices").select("*").in_("ticker", play_tickers).gte("fetched_at", five_days_ago).execute()
            prices_data = prices_res.data or []
            prices_data.sort(key=lambda x: x["fetched_at"], reverse=True)
            
            latest_prices = {}
            for row in prices_data:
                if row["ticker"] not in latest_prices:
                    latest_prices[row["ticker"]] = row
                    
            for play in plays:
                price_row = latest_prices.get(play["ticker"])
                if price_row:
                    play["current_price"] = price_row["price"]
                    play["price_fetched_at"] = price_row["fetched_at"]
                    op = price_row.get("open_price")
                    if op and op > 0:
                        play["price_change_pct"] = round(((play["current_price"] - op) / op) * 100, 2)
                else:
                    play["current_price"] = None
                    play["price_change_pct"] = None
                    play["price_fetched_at"] = None
        except Exception as e:
            logger.error(f"Failed to fetch prices for radar plays: {e}")

    payload = {
        "plays": plays,
        "generated_at": now.isoformat()
    }

    await set_cache(cache_key, payload)
    return payload


def compute_radar_stats(radar_def: RadarDefinition, all_plays: List[dict], db_trend: List[RadarTrendPoint] = None) -> RadarResponse:
    radar_tickers = [t.upper() for t in radar_def.tickers]
    
    radar_plays = []

    # Create a lookup for fast access
    plays_by_ticker = {p.get("ticker", "").upper(): p for p in all_plays}

    for t in radar_tickers:
        if t in plays_by_ticker:
            # Only include necessary fields for radar card
            play = plays_by_ticker[t]
            radar_plays.append({
                "ticker": play["ticker"],
                "stock_name": play["stock_name"],
                "aura_score": play["aura_score"],
                "omni_score": play["omni_score"],
                "recent_mentions": play["recent_mentions"],
                "avg_conviction": play["avg_conviction"],
                "consensus_sentiment": play.get("consensus_sentiment", 0),
                "action_label": play.get("action_label", "Neutral"),
                "avg_target_price": play.get("avg_target_price"),
                "analyst_count": play.get("analyst_count", 0),
                "agreement_pct": play.get("agreement_pct", 0),
                "top_catalyst": play.get("top_catalyst", ""),
                "latest_mention_date": play.get("latest_mention_date")
            })
        else:
            # Create a zero-stat placeholder for tickers with no recent plays
            radar_plays.append({
                "ticker": t,
                "stock_name": lookup_stock_name(t),
                "aura_score": 0,
                "omni_score": 0,
                "recent_mentions": 0,
                "avg_conviction": 0.0,
                "consensus_sentiment": 0.0,
                "action_label": "Neutral",
                "avg_target_price": None,
                "analyst_count": 0,
                "agreement_pct": 0,
                "top_catalyst": "No recent plays.",
                "latest_mention_date": None
            })
            
    if not radar_plays:
        return RadarResponse(
            name=radar_def.name,
            slug=radar_def.slug,
            description=radar_def.description,
            tickers=radar_def.tickers,
            theme_color=radar_def.theme_color,
            icon=radar_def.icon,
            category=radar_def.category,
            sentiment_pulse=0.0,
            aura_score=0,
            omni_score=0,
            volume=0,
            latest_mention_date=None,
            trend=[],
            plays=[]
        )
        
    valid_plays = [p for p in radar_plays if p.get("recent_mentions", 0) > 0]
    total_sentiment = 0.0
    total_aura_score = 0
    total_omni_score = 0
    total_volume = 0
    radar_latest_mention = max([p.get("latest_mention_date") for p in radar_plays if p.get("latest_mention_date")], default=None)
    
    for play in valid_plays:
        total_sentiment += play.get("consensus_sentiment", 0.0)
        total_aura_score += play.get("aura_score", 0)
        total_omni_score += play.get("omni_score", 0)
        total_volume += play.get("recent_mentions", 0)
        
    count = len(valid_plays)
    avg_sentiment = total_sentiment / count if count > 0 else 0.0
    avg_aura = int(total_aura_score / count) if count > 0 else 0
    avg_omni = int(total_omni_score / count) if count > 0 else 0
    
    # Use database history if available and has enough data points, otherwise fallback to synthetic
    trend = db_trend
    if not trend or len(trend) < 2:  # If less than 2 points, chart is flat, so use synthetic
        # Generate synthetic 30-day trend for legacy support during migration
        trend = []
        now = datetime.now(timezone.utc)
        for i in range(30, -1, -5):  # 7 data points
            dt = now - timedelta(days=i)
            # Add some random noise for visualization based on the slug hash
            noise = (hash(radar_def.slug + str(i)) % 10) - 5
            simulated_score = max(0, min(100, avg_aura + noise))
            trend.append(RadarTrendPoint(
                date=dt.strftime("%Y-%m-%d"),
                aura_score=simulated_score
            ))
        
    return RadarResponse(
        name=radar_def.name,
        slug=radar_def.slug,
        description=radar_def.description,
        tickers=radar_def.tickers,
        theme_color=radar_def.theme_color,
        icon=radar_def.icon,
        category=radar_def.category,
        sentiment_pulse=round(avg_sentiment, 2),
        aura_score=avg_aura,
        omni_score=avg_omni,
        volume=total_volume,
        latest_mention_date=radar_latest_mention,
        trend=trend,
        plays=radar_plays
    )

@router.get("", response_model=List[RadarResponse])
async def get_radars(request: Request, response: Response):
    """Retrieve all radars with their aggregated stats."""
    try:
        plays_data = await get_radar_plays_data()
        all_plays = plays_data.get("plays", [])
        radars_defs = await get_radars_from_db()

        # Batch fetch history to avoid N+1 queries
        from app.database import _get_client
        client = _get_client()

        radars_res = client.table("radars").select("id", "slug").execute()
        radar_id_to_slug = {r["id"]: r["slug"] for r in radars_res.data} if radars_res.data else {}

        history_by_slug = {}
        if radar_id_to_slug:
            now = datetime.now(timezone.utc)
            thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
            hist_res = (
                client.table("radar_history")
                .select("*")
                .in_("radar_id", list(radar_id_to_slug.keys()))
                .gte("date", thirty_days_ago)
                .order("date", desc=False)
                .execute()
            )
            for row in (hist_res.data or []):
                r_id = row["radar_id"]
                slug = radar_id_to_slug.get(r_id)
                if slug:
                    if slug not in history_by_slug:
                        history_by_slug[slug] = []
                    history_by_slug[slug].append(RadarTrendPoint(
                        date=row["date"],
                        aura_score=row["aura_score"]
                    ))

        radars = []
        for r_def in radars_defs:
            trend = history_by_slug.get(r_def.slug, [])
            radars.append(compute_radar_stats(r_def, all_plays, trend))

        # Sort radars by latest mention date, then aura score
        radars.sort(key=lambda r: (r.latest_mention_date or "", r.aura_score), reverse=True)
        return radars

    except Exception as e:
        logger.error(f"Error calculating radars: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating radars: {str(e)}"
        )

@router.get("/{slug}", response_model=RadarResponse)
async def get_radar(slug: str, request: Request, response: Response):
    """Retrieve a specific radar by slug."""
    try:
        radars_defs = await get_radars_from_db()
        radar_def = next((r for r in radars_defs if r.slug == slug), None)
        if not radar_def:
            raise HTTPException(status_code=404, detail="Radar not found")

        plays_data = await get_radar_plays_data()
        all_plays = plays_data.get("plays", [])

        trend = await get_radar_history(radar_def.slug)

        return compute_radar_stats(radar_def, all_plays, trend)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching radar {slug}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating radar: {str(e)}"
        )
