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

# --- Curated Radars Definition ---
RADARS = [
    RadarDefinition(
        name="The Mag 7",
        slug="mag-7",
        description="The mega-cap tech giants driving major index movements.",
        tickers=["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA"],
        theme_color="#FFD700", # Golden/Purple Aura
        icon="crown"
    ),
    RadarDefinition(
        name="MANGOS",
        slug="mangos",
        description="The new AI frontier and next-gen tech leadership.",
        tickers=["META", "ANTH", "NVDA", "GOOGL", "OAI", "SPCX"],
        theme_color="#F59E0B", # Amber Aura
        icon="spark"
    ),
    RadarDefinition(
        name="AI Infrastructure",
        slug="ai-infrastructure",
        description="The hardware and foundry backbone of artificial intelligence.",
        tickers=["AMD", "SMCI", "TSM", "ASML", "ARM", "PLTR", "MU"],
        theme_color="#00FFFF", # Electric Blue Aura
        icon="microchip"
    ),
    RadarDefinition(
        name="GLP-1 & Bio",
        slug="glp-1",
        description="The massive biotech wave driven by weight-loss drugs.",
        tickers=["LLY", "NVO", "AMGN", "VKTX"],
        theme_color="#6366F1", # Indigo Aura
        icon="dna"
    ),
    RadarDefinition(
        name="Bitcoin Proxies",
        slug="crypto-proxies",
        description="Public companies acting as high-beta plays on cryptocurrency.",
        tickers=["MSTR", "COIN", "MARA", "RIOT", "IBIT"],
        theme_color="#F7931A", # Crypto Orange Aura
        icon="bitcoin"
    ),
    RadarDefinition(
        name="Defense & Aero",
        slug="defense",
        description="Aerospace and tactical contractors amidst global rearmament.",
        tickers=["LMT", "RTX", "NOC", "GD"],
        theme_color="#FFBF00", # Tactical Amber Aura
        icon="shield"
    )
]

async def get_all_plays_data() -> dict:
    """Fetch all today's plays from cache or compute them."""
    days = 30
    strategy = "mentions"
    cache_key = f"aura_today_plays_{days}_{strategy}"
    
    cached_data = await get_cache(cache_key)
    latest_extraction = await get_latest_extraction_time()
    
    if cached_data and latest_extraction:
        cache_updated = parse_iso_datetime(cached_data.get("last_updated"))
        latest_ext_dt = parse_iso_datetime(latest_extraction)
        
        if cache_updated >= latest_ext_dt:
            return cached_data["payload"]
            
    # Cache miss or stale -> calculate
    result = await calculate_today_plays(days, strategy)
    payload = result.dict()
    await set_cache(cache_key, payload)
    return payload


def compute_radar_stats(radar_def: RadarDefinition, all_plays: List[dict]) -> RadarResponse:
    radar_tickers = [t.upper() for t in radar_def.tickers]
    
    radar_plays = []
    
    # Create a lookup for fast access
    plays_by_ticker = {p.get("ticker", "").upper(): p for p in all_plays}
    
    for t in radar_tickers:
        if t in plays_by_ticker:
            radar_plays.append(plays_by_ticker[t])
        else:
            # Create a zero-stat placeholder for tickers with no recent plays
            radar_plays.append({
                "ticker": t,
                "stock_name": lookup_stock_name(t),
                "direction": "NEUTRAL",
                "aura_score": 0,
                "omni_score": 0,
                "action_label": "Neutral",
                "consensus_sentiment": 0.0,
                "avg_conviction": 0.0,
                "avg_target_price": None,
                "recent_mentions": 0,
                "analyst_count": 0,
                "agreement_pct": 0,
                "top_catalyst": "No recent coverage",
                "catalysts": [],
                "why_bullets": ["0 mentions this week", "No active consensus"],
                "latest_video": {"channel_name": "", "published_at": "", "youtube_video_id": ""}
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
    
    # For now, generate a synthetic 30-day trend based on the current aura score 
    # since we don't have historical daily snapshots yet. 
    # We will simulate a slight fluctuation around the average to populate the chart.
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
        plays_data = await get_all_plays_data()
        all_plays = plays_data.get("plays", [])
        
        radars = [compute_radar_stats(r, all_plays) for r in RADARS]
        
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
        radar_def = next((r for r in RADARS if r.slug == slug), None)
        if not radar_def:
            raise HTTPException(status_code=404, detail="Radar not found")
            
        plays_data = await get_all_plays_data()
        all_plays = plays_data.get("plays", [])
        
        return compute_radar_stats(radar_def, all_plays)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching radar {slug}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating radar: {str(e)}"
        )
