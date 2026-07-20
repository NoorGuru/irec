import asyncio
import logging
from datetime import datetime, timezone
import yfinance as yf

logger = logging.getLogger(__name__)

# Simple in-memory cache to avoid redundant yfinance calls.
# Dict maps ticker -> (TickerInfo | None, expiration_timestamp)
_ticker_cache: dict[str, tuple[object, float]] = {}
CACHE_TTL_SECONDS = 86400  # 24 hours

class TickerInfo:
    def __init__(self, name: str):
        self.name = name

async def validate_tickers_live(tickers: list[str]) -> dict[str, TickerInfo | None]:
    """Validate a list of tickers using yfinance.
    
    Returns a dict mapping ticker -> TickerInfo (if valid) or None (if invalid).
    If validation fails completely, it fails open (returns empty names) so we don't drop legitimate tickers.
    """
    result = {}
    to_fetch = []
    now = datetime.now(timezone.utc).timestamp()
    
    for t in tickers:
        clean_t = t.upper().strip()
        
        # Check cache
        if clean_t in _ticker_cache:
            cached_val, expires_at = _ticker_cache[clean_t]
            if now < expires_at:
                result[clean_t] = cached_val
                continue
                
        to_fetch.append(clean_t)
            
    if not to_fetch:
        return result
        
    def fetch_info():
        fetched = {}
        for t in to_fetch:
            try:
                ticker_obj = yf.Ticker(t)
                info = ticker_obj.info
                name = info.get("longName") or info.get("shortName")
                
                # A ticker is generally valid if it has a name, price, or exchange
                if name or info.get("regularMarketPrice") or info.get("previousClose") or info.get("exchange"):
                    fetched[t] = TickerInfo(name=name or "")
                else:
                    fetched[t] = None
            except Exception as e:
                logger.warning(f"yfinance error for individual ticker {t}: {e}")
                # Fail open for this specific ticker
                fetched[t] = TickerInfo(name="")
        return fetched

    try:
        fetched_results = await asyncio.to_thread(fetch_info)
        for t, info_obj in fetched_results.items():
            result[t] = info_obj
            # Cache the result
            _ticker_cache[t] = (info_obj, now + CACHE_TTL_SECONDS)
    except Exception as e:
        logger.error(f"yfinance validation thread failed: {e}. Failing open.")
        for t in to_fetch:
            # Fail open
            info_obj = TickerInfo(name="")
            result[t] = info_obj
            # Don't cache fail-open results so we try again next time
            
    return result
