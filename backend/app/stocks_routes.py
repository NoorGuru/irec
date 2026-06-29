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
    current_price: float | None = None
    price_change_pct: float | None = None
    price_fetched_at: str | None = None
    overall_sentiment: float | None = None
    avg_target_price: float | None = None
    avg_conviction: float | None = None

class StocksDirectoryResponse(BaseModel):
    stocks: List[StockDirectoryItem]
    generated_at: str

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
                
        # Get latest prices
        five_days_ago = (now - timedelta(days=5)).isoformat()
        prices_res = client.table("stock_prices").select("*").in_("ticker", tickers).gte("fetched_at", five_days_ago).execute()
        prices_data = prices_res.data or []
        prices_data.sort(key=lambda x: x["fetched_at"], reverse=True)
        
        latest_prices = {}
        for p in prices_data:
            if p["ticker"] not in latest_prices:
                latest_prices[p["ticker"]] = p
                
        # Assemble
        result_stocks = []
        for m in meta_data:
            t = m["ticker"]
            
            price_data = latest_prices.get(t)
            current_price = None
            price_change_pct = None
            price_fetched_at = None
            
            if price_data:
                current_price = price_data.get("price")
                price_fetched_at = price_data.get("fetched_at")
                op = price_data.get("open_price")
                if op and op > 0 and current_price:
                    price_change_pct = round(((current_price - op) / op) * 100, 2)
                    
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
                current_price=current_price,
                price_change_pct=price_change_pct,
                price_fetched_at=price_fetched_at,
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
