import logging
from typing import List, Dict
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Response

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
            tickers=tickers
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
    cache_key = "radar_plays_data"

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

    # Fetch recommendations with minimal fields
    db_response = (
        client.table("recommendations")
        .select("ticker, target_price, sentiment, conviction_level, videos!inner(published_at, channels!inner(channel_name, trust_weight))")
        .gte("videos.published_at", start_date)
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
    for ticker, recs in ticker_groups.items():
        # Calculate minimal metrics
        recent_mentions = len(recs)
        analyst_count = len(set([(r.get("videos") or {}).get("channels", {}).get("channel_name", "Unknown") for r in recs]))

        sentiments = [r.get("sentiment", 0) for r in recs]
        convictions = [r.get("conviction_level", 5) for r in recs]
        target_prices = [float(r.get("target_price")) for r in recs if r.get("target_price") is not None]

        avg_conviction = sum(convictions) / len(convictions) if recs else 0.0
        avg_target_price = sum(target_prices) / len(target_prices) if target_prices else None

        # Calculate trust-weighted consensus sentiment
        total_weight = 0.0
        weighted_sentiment_sum = 0.0
        for rec in recs:
            sentiment = rec.get("sentiment", 0)
            channel = (rec.get("videos") or {}).get("channels") or {}
            trust_weight = channel.get("trust_weight") or 1.0
            total_weight += trust_weight
            weighted_sentiment_sum += sentiment * trust_weight

        consensus_sentiment = weighted_sentiment_sum / total_weight if total_weight > 0 else 0.0

        # Calculate simple scores
        aura_score = int(50 + (consensus_sentiment * 25))
        omni_score = aura_score

        plays.append({
            "ticker": ticker,
            "stock_name": lookup_stock_name(ticker),
            "aura_score": aura_score,
            "omni_score": omni_score,
            "recent_mentions": recent_mentions,
            "analyst_count": analyst_count,
            "avg_conviction": avg_conviction,
            "consensus_sentiment": consensus_sentiment,
            "avg_target_price": avg_target_price
        })

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
                "avg_conviction": play["avg_conviction"]
            })
        else:
            # Create a zero-stat placeholder for tickers with no recent plays
            radar_plays.append({
                "ticker": t,
                "stock_name": lookup_stock_name(t),
                "aura_score": 0,
                "omni_score": 0,
                "recent_mentions": 0,
                "avg_conviction": 0.0
            })
            
    if not radar_plays:
        return RadarResponse(
            name=radar_def.name,
            slug=radar_def.slug,
            description=radar_def.description,
            tickers=radar_def.tickers,
            theme_color=radar_def.theme_color,
            icon=radar_def.icon,
            sentiment_pulse=0.0,
            aura_score=0,
            omni_score=0,
            volume=0,
            trend=[],
            plays=[]
        )
        
    valid_plays = [p for p in radar_plays if p.get("recent_mentions", 0) > 0]
    total_sentiment = 0.0
    total_aura_score = 0
    total_omni_score = 0
    total_volume = 0
    
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
        sentiment_pulse=round(avg_sentiment, 2),
        aura_score=avg_aura,
        omni_score=avg_omni,
        volume=total_volume,
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

        # Sort radars by aura score
        radars.sort(key=lambda r: r.aura_score, reverse=True)
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
