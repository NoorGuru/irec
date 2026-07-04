import logging
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.database import _get_client, get_cache, set_cache, get_latest_extraction_time
from app.today_routes import parse_iso_datetime

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1",
    tags=["stocks"],
)

class StockDirectoryItem(BaseModel):
    ticker: str
    stock_name: str | None = None
    tier: int
    is_pinned: bool
    priority_score: float
    mention_count_30d: int
    analyst_count: int
    last_mentioned_at: str | None = None

    overall_sentiment: float | None = None
    avg_target_price: float | None = None
    avg_conviction: float | None = None

class StocksDirectoryResponse(BaseModel):
    stocks: List[StockDirectoryItem]
    generated_at: str

class AggregatedTickerResponse(BaseModel):
    ticker: str
    stock_name: str
    consensus_sentiment: float
    avg_target_price: float | None = None
    avg_conviction: float
    mention_count: int
    analyst_count: int

class HomePulseResponse(BaseModel):
    aggregated: List[AggregatedTickerResponse]


@router.get("/stocks", response_model=StocksDirectoryResponse)
async def get_stocks_directory(request: Request, response: Response):
    """Fetch public directory of all tracked stocks with their latest prices and unified aggregated metrics."""
    try:
        cache_key = "stocks_directory_v6"
        cached_data = await get_cache(cache_key)
        latest_extraction = await get_latest_extraction_time()
        
        if cached_data and latest_extraction:
            cache_updated = parse_iso_datetime(cached_data.get("last_updated"))
            latest_ext_dt = parse_iso_datetime(latest_extraction)
            
            if cache_updated >= latest_ext_dt:
                payload = cached_data["payload"]
                etag = f'W/"{payload.get("generated_at")}"'
                if request.headers.get("if-none-match") == etag:
                    return Response(status_code=304)
                response.headers["ETag"] = etag
                return payload
                
        # Cache miss, calculate
        client = _get_client()
        now = datetime.now(timezone.utc)
        
        # Get stock meta
        meta_res = client.table("stock_meta").select("*").execute()
        meta_data = meta_res.data or []
        
        tickers = [m["ticker"] for m in meta_data]
        
        # Get names, sentiment, targets, and conviction from recommendations
        recs_res = client.table("recommendations").select("ticker, stock_name, sentiment, target_price, conviction_level").execute()
        recs_data = recs_res.data or []
        
        names_map = {}
        sentiment_map = {}
        sentiment_counts = {}
        target_map = {}
        target_counts = {}
        conviction_map = {}
        conviction_counts = {}
        
        for r in recs_data:
            t = r["ticker"]
            if t not in names_map and r.get("stock_name"):
                names_map[t] = r["stock_name"]
            
            s = r.get("sentiment")
            if s is not None:
                sentiment_map[t] = sentiment_map.get(t, 0) + s
                sentiment_counts[t] = sentiment_counts.get(t, 0) + 1
                
            tp = r.get("target_price")
            if tp is not None:
                target_map[t] = target_map.get(t, 0) + tp
                target_counts[t] = target_counts.get(t, 0) + 1
                
            cl = r.get("conviction_level")
            if cl is not None:
                conviction_map[t] = conviction_map.get(t, 0) + cl
                conviction_counts[t] = conviction_counts.get(t, 0) + 1
                

        # Assemble
        result_stocks = []
        for m in meta_data:
            t = m["ticker"]
            

            overall_sentiment = None
            if sentiment_counts.get(t, 0) > 0:
                overall_sentiment = sentiment_map[t] / sentiment_counts[t]
                
            avg_target_price = None
            if target_counts.get(t, 0) > 0:
                avg_target_price = target_map[t] / target_counts[t]
                
            avg_conviction = None
            if conviction_counts.get(t, 0) > 0:
                avg_conviction = conviction_map[t] / conviction_counts[t]
                
            item = StockDirectoryItem(
                ticker=t,
                stock_name=names_map.get(t),
                tier=1 if m.get("is_pinned", False) else m.get("tier", 2),
                is_pinned=m.get("is_pinned", False),
                priority_score=m.get("priority_score", 0.0),
                mention_count_30d=m.get("mention_count_30d", 0),
                analyst_count=m.get("analyst_count", 0),
                last_mentioned_at=m.get("last_mentioned_at"),

                overall_sentiment=overall_sentiment,
                avg_target_price=avg_target_price,
                avg_conviction=avg_conviction
            )
            result_stocks.append(item)
            
        result_stocks.sort(key=lambda x: (x.tier, -x.priority_score))
        
        payload = {
            "stocks": [s.model_dump() for s in result_stocks],
            "generated_at": now.isoformat()
        }
        
        await set_cache(cache_key, payload)
        
        etag = f'W/"{payload["generated_at"]}"'
        response.headers["ETag"] = etag
        
        return payload
    except Exception as e:
        logger.error(f"Error fetching stocks directory: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/home/pulse", response_model=HomePulseResponse)
async def get_home_pulse(request: Request, response: Response):
    """Fetch trust-weighted aggregated metrics for all tracked stocks for the homepage Market Pulse."""
    try:
        cache_key = "home_pulse_v1"
        cached_data = await get_cache(cache_key)
        latest_extraction = await get_latest_extraction_time()
        
        if cached_data and latest_extraction:
            cache_updated = parse_iso_datetime(cached_data.get("last_updated"))
            latest_ext_dt = parse_iso_datetime(latest_extraction)
            
            if cache_updated >= latest_ext_dt:
                payload = cached_data["payload"]
                etag = f'W/"{payload.get("generated_at")}"'
                if request.headers.get("if-none-match") == etag:
                    return Response(status_code=304)
                response.headers["ETag"] = etag
                return payload

        # Cache miss, compute aggregation
        client = _get_client()
        now = datetime.now(timezone.utc)
        
        # Querying recommendations and joins
        recs_res = client.table("recommendations").select("""
            ticker,
            stock_name,
            sentiment,
            target_price,
            conviction_level,
            videos!inner(
                channel_id,
                channels!inner(trust_weight)
            )
        """).execute()
        recs_data = recs_res.data or []

        grouped = {}
        for r in recs_data:
            ticker = r["ticker"]
            if not ticker:
                continue
            if ticker not in grouped:
                grouped[ticker] = {
                    "sentiments": [],
                    "prices": [],
                    "convictions": [],
                    "count": 0,
                    "channels": set(),
                    "stock_name": r.get("stock_name") or ""
                }
            group = grouped[ticker]
            
            video = r.get("videos") or {}
            channel = video.get("channels") or {}
            trust_weight = channel.get("trust_weight")
            if trust_weight is None:
                trust_weight = 1.0 # fallback
            
            sentiment = r.get("sentiment")
            if sentiment is not None:
                group["sentiments"].append({"value": sentiment, "weight": trust_weight})
                
            tp = r.get("target_price")
            if tp is not None:
                group["prices"].append(tp)
                
            cl = r.get("conviction_level")
            if cl is not None:
                group["convictions"].append(cl)
                
            channel_id = video.get("channel_id")
            if channel_id:
                group["channels"].add(channel_id)
                
            group["count"] += 1
            if r.get("stock_name") and not group["stock_name"]:
                group["stock_name"] = r["stock_name"]

        results = []
        for ticker, group in grouped.items():
            sentiments = group["sentiments"]
            weighted_sum = sum(s["value"] * s["weight"] for s in sentiments)
            total_weight = sum(s["weight"] for s in sentiments)
            
            raw_sentiment = weighted_sum / total_weight if total_weight > 0 else 0.0
            confidence = min(group["count"] / 3.0, 1.0)
            consensus_sentiment = round(raw_sentiment * confidence, 2)
            
            prices = group["prices"]
            avg_target_price = sum(prices) / len(prices) if len(prices) > 0 else None
            
            convictions = group["convictions"]
            avg_conviction = sum(convictions) / len(convictions) if len(convictions) > 0 else 0.0
            
            results.append(AggregatedTickerResponse(
                ticker=ticker,
                stock_name=group["stock_name"],
                consensus_sentiment=consensus_sentiment,
                avg_target_price=avg_target_price,
                avg_conviction=avg_conviction,
                mention_count=group["count"],
                analyst_count=len(group["channels"])
            ))
            
        results.sort(key=lambda x: x.mention_count, reverse=True)

        payload = {
            "aggregated": [r.model_dump() for r in results],
            "generated_at": now.isoformat()
        }
        
        await set_cache(cache_key, payload)
        
        etag = f'W/"{payload["generated_at"]}"'
        response.headers["ETag"] = etag
        
        return payload
    except Exception as e:
        logger.error(f"Error fetching home pulse data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")

