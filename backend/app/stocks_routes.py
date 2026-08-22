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
async def get_stocks_directory(request: Request, response: Response, fresh: bool = False):
    """Fetch public directory of all tracked stocks with their latest prices and unified aggregated metrics."""
    try:
        cache_key = "stocks_directory_v7"
        cached_data = await get_cache(cache_key)
        latest_extraction = await get_latest_extraction_time()
        
        if cached_data and latest_extraction:
            cache_updated = parse_iso_datetime(cached_data.get("last_updated"))
            latest_ext_dt = parse_iso_datetime(latest_extraction)
            
            if cache_updated >= latest_ext_dt and not fresh:
                payload = cached_data["payload"]
                etag = f'W/"{payload.get("generated_at")}"'
                if request.headers.get("if-none-match") == etag:
                    return Response(status_code=304)
                response.headers["ETag"] = etag
                return payload
                
        # Cache miss, calculate
        client = _get_client()
        now = datetime.now(timezone.utc)
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        
        # Get stock meta
        meta_res = client.table("stock_meta").select("*").execute()
        meta_data = meta_res.data or []
        
        tickers = [m["ticker"] for m in meta_data]
        
        # Get names, sentiment, targets, conviction, published_at, and channels from recommendations
        # Note: We must paginate because there can be >1000 recommendations and Supabase defaults to 1000.
        recs_data = []
        page_size = 1000
        for i in range(20): # handle up to 20,000 recommendations
            res = client.table("recommendations").select("ticker, stock_name, sentiment, target_price, conviction_level, videos!inner(published_at, channels!inner(channel_name, trust_weight))").range(i * page_size, (i + 1) * page_size - 1).execute()
            if not res.data:
                break
            recs_data.extend(res.data)
            if len(res.data) < page_size:
                break
        
        names_map = {}
        sentiment_map = {}
        sentiment_counts = {}
        weighted_sentiment_map = {}
        total_trust_weight = {}
        target_map = {}
        target_counts = {}
        conviction_map = {}
        conviction_counts = {}
        last_mentioned_map = {}
        mentions_30d_map = {}
        analysts_map = {}
        
        for r in recs_data:
            t = r["ticker"]
            if t not in names_map and r.get("stock_name"):
                names_map[t] = r["stock_name"]
            
            video = r.get("videos") or {}
            pub_str = video.get("published_at")
            if pub_str:
                if t not in last_mentioned_map or pub_str > last_mentioned_map[t]:
                    last_mentioned_map[t] = pub_str
                if pub_str >= thirty_days_ago:
                    mentions_30d_map[t] = mentions_30d_map.get(t, 0) + 1
            
            channels = video.get("channels") or {}
            cname = channels.get("channel_name")
            if cname:
                if t not in analysts_map:
                    analysts_map[t] = set()
                analysts_map[t].add(cname)
            
            s = r.get("sentiment")
            if s is not None:
                tw = channels.get("trust_weight", 1.0) or 1.0
                sentiment_map[t] = sentiment_map.get(t, 0) + s
                sentiment_counts[t] = sentiment_counts.get(t, 0) + 1
                weighted_sentiment_map[t] = weighted_sentiment_map.get(t, 0) + (s * tw)
                total_trust_weight[t] = total_trust_weight.get(t, 0) + tw
                
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
            raw_sentiment_val = None
            if sentiment_counts.get(t, 0) > 0:
                # Raw unweighted sentiment (matches Ticker page "Raw Sentiment")
                raw_sentiment_val = round(sentiment_map[t] / sentiment_counts[t], 2)
                
                # Consensus Sentiment (trust-weighted & confidence-dampened, matches Ticker "Consensus")
                tw = total_trust_weight.get(t, 0)
                w_sum = weighted_sentiment_map.get(t, 0)
                raw_weighted = w_sum / tw if tw > 0 else 0
                confidence = min(sentiment_counts[t] / 3, 1)
                overall_sentiment = round(raw_weighted * confidence, 2)
                
            avg_target_price = None
            if target_counts.get(t, 0) > 0:
                avg_target_price = round(target_map[t] / target_counts[t], 2)
                
            avg_conviction = None
            if conviction_counts.get(t, 0) > 0:
                avg_conviction = round(conviction_map[t] / conviction_counts[t], 2)
                
            last_mentioned = last_mentioned_map.get(t) or m.get("last_mentioned_at")
            m_count_30d = mentions_30d_map.get(t, 0) if mentions_30d_map else m.get("mention_count_30d", 0)
            a_count = len(analysts_map.get(t, set())) if analysts_map else m.get("analyst_count", 0)
            
            item = StockDirectoryItem(
                ticker=t,
                stock_name=names_map.get(t),
                tier=1 if m.get("is_pinned", False) else m.get("tier", 2),
                is_pinned=m.get("is_pinned", False),
                priority_score=m.get("priority_score", 0.0),
                mention_count_30d=m_count_30d,
                analyst_count=a_count,
                last_mentioned_at=last_mentioned,
                overall_sentiment=overall_sentiment,
                raw_sentiment=raw_sentiment_val,
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
        # Note: We must paginate because there can be >1000 recommendations and Supabase defaults to 1000.
        recs_data = []
        page_size = 1000
        for i in range(20): # handle up to 20,000 recommendations
            res = client.table("recommendations").select("""
                ticker,
                stock_name,
                sentiment,
                target_price,
                conviction_level,
                videos!inner(
                    channel_id,
                    channels!inner(trust_weight)
                )
            """).range(i * page_size, (i + 1) * page_size - 1).execute()
            if not res.data:
                break
            recs_data.extend(res.data)
            if len(res.data) < page_size:
                break

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

class PerformanceResponse(BaseModel):
    symbol: str
    range: str
    is_up: bool
    change_percent: float

@router.get("/{symbol}/performance", response_model=PerformanceResponse)
async def get_stock_performance(symbol: str, range: str = "12M"):
    """Fetch historical performance for a ticker over a given range to determine if it is up or down."""
    import yfinance as yf
    
    range_map = {
        "1M": "1mo",
        "3M": "3mo",
        "12M": "1y",
        "60M": "5y",
        "ALL": "max"
    }
    yf_range = range_map.get(range, "1y")
    
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=yf_range)
        
        if hist.empty:
            return PerformanceResponse(symbol=symbol, range=range, is_up=True, change_percent=0.0)
            
        start_price = float(hist['Close'].iloc[0])
        end_price = float(hist['Close'].iloc[-1])
        
        change_pct = ((end_price - start_price) / start_price) * 100 if start_price > 0 else 0.0
        
        return PerformanceResponse(
            symbol=symbol,
            range=range,
            is_up=change_pct >= 0,
            change_percent=change_pct
        )
    except Exception as e:
        logger.error(f"Error fetching performance for {symbol}: {e}")
        # Default to positive if error
        return PerformanceResponse(symbol=symbol, range=range, is_up=True, change_percent=0.0)

