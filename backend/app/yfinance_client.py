import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone
import yfinance as yf
from app.stock_ingestion_schemas import StockPrice

logger = logging.getLogger(__name__)

class YFinanceClient:
    """yfinance wrapper for EOD data and Tier 1 fallback."""
    
    async def fetch_eod_bulk(self, symbols: List[str]) -> Dict[str, Optional[StockPrice]]:
        """Fetch end-of-day data for many symbols at once."""
        results: Dict[str, Optional[StockPrice]] = {sym: None for sym in symbols}
        
        if not symbols:
            return results

        try:
            # yf.download is synchronous, wrap in to_thread
            def download_data():
                return yf.download(symbols, period="1d", group_by="ticker", auto_adjust=True, progress=False)

            data = await asyncio.to_thread(download_data)
            fetched_at = datetime.now(timezone.utc).isoformat()
            
            if len(symbols) == 1:
                sym = symbols[0]
                if not data.empty:
                    row = data.iloc[-1]
                    results[sym] = self._parse_yf_row(sym, row, fetched_at)
            else:
                for sym in symbols:
                    if sym in data and not data[sym].empty:
                        row = data[sym].iloc[-1]
                        results[sym] = self._parse_yf_row(sym, row, fetched_at)

        except Exception as e:
            logger.error(f"yfinance bulk fetch error: {e}")
            
        return results

    async def fetch_single(self, symbol: str) -> Optional[StockPrice]:
        """Fallback fetch for a single symbol."""
        try:
            def download_single():
                return yf.download(symbol, period="1d", auto_adjust=True, progress=False)
                
            data = await asyncio.to_thread(download_single)
            
            if not data.empty:
                fetched_at = datetime.now(timezone.utc).isoformat()
                row = data.iloc[-1]
                return self._parse_yf_row(symbol, row, fetched_at)
        except Exception as e:
            logger.error(f"yfinance single fetch error for {symbol}: {e}")
            
        return None

    def _parse_yf_row(self, symbol: str, row, fetched_at: str) -> StockPrice:
        try:
            return StockPrice(
                ticker=symbol,
                price=float(row.get("Close", 0.0)),
                open_price=float(row.get("Open", 0.0)) if "Open" in row else None,
                high=float(row.get("High", 0.0)) if "High" in row else None,
                low=float(row.get("Low", 0.0)) if "Low" in row else None,
                volume=int(row.get("Volume", 0)) if "Volume" in row else None,
                source="yfinance",
                fetched_at=fetched_at
            )
        except Exception as e:
            logger.warning(f"Failed to parse yfinance data for {symbol}: {e}")
            return StockPrice(
                ticker=symbol,
                price=0.0,
                source="yfinance",
                fetched_at=fetched_at
            )
