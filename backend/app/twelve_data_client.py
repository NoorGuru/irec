import os
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.stock_ingestion_schemas import StockPrice

logger = logging.getLogger(__name__)

class TwelveDataClient:
    """Twelve Data API client with quota guard and fallback signaling."""
    
    BASE_URL = "https://api.twelvedata.com"
    BATCH_SIZE = 8  # Free tier: max 8 symbols per request
    DAILY_CREDIT_CEILING = 780  # Hard limit (800 - 20 buffer)
    
    def __init__(self):
        self.api_key = os.environ.get("TWELVE_DATA_API_KEY")
        if not self.api_key:
            logger.warning("TWELVE_DATA_API_KEY is not set. TwelveDataClient will fail requests.")
            
    async def fetch_batch_prices(self, symbols: List[str]) -> Dict[str, Optional[StockPrice]]:
        """Fetch prices for up to 8 symbols. Returns None for failed symbols."""
        results: Dict[str, Optional[StockPrice]] = {sym: None for sym in symbols}
        
        if not self.api_key:
            return results
            
        if len(symbols) > self.BATCH_SIZE:
            logger.error(f"Cannot request more than {self.BATCH_SIZE} symbols at once.")
            return results

        # Deduplicate and join
        unique_symbols = list(set(symbols))
        symbol_str = ",".join(unique_symbols)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/quote",
                    params={
                        "symbol": symbol_str,
                        "apikey": self.api_key,
                        "dp": 2  # 2 decimal places
                    }
                )
                
                # Check for HTTP errors
                if response.status_code == 429:
                    logger.warning("Twelve Data API rate limit reached (HTTP 429).")
                    return results
                
                response.raise_for_status()
                data = response.json()
                
                # Check for API-level errors (sometimes status is 200 but contains an error)
                if "code" in data and data["code"] == 429:
                    logger.warning(f"Twelve Data API rate limit reached: {data.get('message')}")
                    return results

                # Determine if single symbol or multiple
                fetched_at = datetime.now(timezone.utc).isoformat()
                
                if len(unique_symbols) == 1:
                    # Single response format
                    if "symbol" in data:
                        sym = data["symbol"].upper()
                        results[sym] = self._parse_quote(sym, data, fetched_at)
                else:
                    # Multi-symbol response format
                    for sym in unique_symbols:
                        if sym in data and "symbol" in data[sym]:
                            results[sym] = self._parse_quote(sym, data[sym], fetched_at)

        except httpx.TimeoutException:
            logger.warning(f"Twelve Data API timeout for symbols {symbol_str}.")
        except Exception as e:
            logger.error(f"Twelve Data API error for {symbol_str}: {e}")
            
        return results

    def _parse_quote(self, symbol: str, quote_data: dict, fetched_at: str) -> StockPrice:
        try:
            return StockPrice(
                ticker=symbol,
                price=float(quote_data.get("close", quote_data.get("previous_close", 0))),
                open_price=float(quote_data.get("open", 0)) if quote_data.get("open") else None,
                high=float(quote_data.get("high", 0)) if quote_data.get("high") else None,
                low=float(quote_data.get("low", 0)) if quote_data.get("low") else None,
                volume=int(quote_data.get("volume", 0)) if quote_data.get("volume") else None,
                source="twelvedata",
                fetched_at=fetched_at
            )
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to parse quote data for {symbol}: {e}")
            # Fallback to defaults
            return StockPrice(
                ticker=symbol,
                price=0.0,
                source="twelvedata",
                fetched_at=fetched_at
            )

    async def get_credits_remaining(self) -> int:
        """Return estimated remaining credits for today.
        Note: The free tier doesn't easily expose this, but we can call /usage if needed.
        For now, this returns a dummy value. The actual tracking should be done via db.
        """
        if not self.api_key:
            return 0
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/usage",
                    params={"apikey": self.api_key}
                )
                if response.status_code == 200:
                    data = response.json()
                    # e.g. "current_usage": 150, "plan_limit": 800
                    current = data.get("current_usage", 0)
                    limit = data.get("plan_limit", 800)
                    return max(0, limit - current)
        except Exception as e:
            logger.error(f"Failed to fetch usage: {e}")
        
        return self.DAILY_CREDIT_CEILING
