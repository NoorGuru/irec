import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from app.database import _get_client
from app.twelve_data_client import TwelveDataClient
from app.yfinance_client import YFinanceClient
from app.stock_ingestion_schemas import IngestionResult, StockPrice

logger = logging.getLogger(__name__)

class StockIngestionService:
    """Orchestrates the hybrid Tier 1 / Tier 2 ingestion pipeline."""

    def __init__(self):
        self.td_client = TwelveDataClient()
        self.yf_client = YFinanceClient()

    async def run_tier1_intraday(self) -> IngestionResult:
        """
        Fetch intraday prices for Tier 1 stocks via Twelve Data.
        Fallback to yfinance on 429/timeout/error.
        """
        return await self._run_tier1("tier1_intraday")

    async def run_tier1_final_close(self) -> IngestionResult:
        """
        Mandatory 5:30 PM EST check for official closing prices.
        """
        return await self._run_tier1("tier1_close")

    async def run_tier2_eod(self) -> IngestionResult:
        """
        Fetch EOD data for all Tier 2 stocks via yfinance.
        """
        run_type = "tier2_eod"
        start_time = datetime.now(timezone.utc)
        
        try:
            client = _get_client()
            
            # 1. Fetch Tier 2 tickers
            tier2_res = client.table("stock_meta").select("ticker").eq("tier", 2).execute()
            if not tier2_res.data:
                return self._build_result(run_type, "success", 0, 0, 0, start_time)

            tickers = [row["ticker"] for row in tier2_res.data]
            
            # 2. Fetch using YFinance
            # Batch size for YF can be large, but we'll do 100 at a time to be safe
            all_prices: List[StockPrice] = []
            failed_count = 0
            
            BATCH_SIZE = 100
            for i in range(0, len(tickers), BATCH_SIZE):
                batch = tickers[i:i+BATCH_SIZE]
                results = await self.yf_client.fetch_eod_bulk(batch)
                
                for sym, price in results.items():
                    if price and price.price > 0:
                        all_prices.append(price)
                    else:
                        failed_count += 1

            # 3. Persist to DB
            self._persist_prices(all_prices)
            self._update_last_price_update(all_prices)

            return self._build_result(
                run_type=run_type,
                status="success" if failed_count == 0 else "partial",
                stocks_total=len(tickers),
                stocks_ok=len(all_prices),
                stocks_failed=failed_count,
                start_time=start_time
            )

        except Exception as e:
            logger.error(f"Tier 2 ingestion failed: {e}")
            return self._build_result(run_type, "failed", 0, 0, 0, start_time, error_detail=str(e))

    async def _run_tier1(self, run_type: str) -> IngestionResult:
        start_time = datetime.now(timezone.utc)
        credits_used = 0
        fallback_used = 0
        all_prices: List[StockPrice] = []
        
        try:
            client = _get_client()
            
            # 1. Fetch Tier 1 tickers
            tier1_res = client.table("stock_meta").select("ticker").eq("tier", 1).execute()
            if not tier1_res.data:
                return self._build_result(run_type, "success", 0, 0, 0, start_time)

            tickers = [row["ticker"] for row in tier1_res.data]
            
            # 2. Process in batches for Twelve Data
            BATCH_SIZE = self.td_client.BATCH_SIZE
            failed_tickers: List[str] = []
            
            for i in range(0, len(tickers), BATCH_SIZE):
                batch = tickers[i:i+BATCH_SIZE]
                
                # Try TwelveData
                td_results = await self.td_client.fetch_batch_prices(batch)
                credits_used += 1  # 1 API call = 1 credit in TD
                
                for sym in batch:
                    price = td_results.get(sym)
                    if price and price.price > 0:
                        all_prices.append(price)
                    else:
                        failed_tickers.append(sym)

            # 3. Fallback to YFinance for failed tickers
            if failed_tickers:
                logger.info(f"Falling back to YFinance for {len(failed_tickers)} tickers: {failed_tickers}")
                fallback_used = len(failed_tickers)
                
                # YFinance can do bulk for fallback too
                for i in range(0, len(failed_tickers), 100):
                    batch = failed_tickers[i:i+100]
                    yf_results = await self.yf_client.fetch_eod_bulk(batch)
                    
                    for sym in batch:
                        price = yf_results.get(sym)
                        if price and price.price > 0:
                            all_prices.append(price)

            # 4. Persist to DB
            self._persist_prices(all_prices)
            self._update_last_price_update(all_prices)

            stocks_ok = len(all_prices)
            stocks_failed = len(tickers) - stocks_ok
            status = "success" if stocks_failed == 0 else ("partial" if stocks_ok > 0 else "failed")

            return self._build_result(
                run_type=run_type,
                status=status,
                stocks_total=len(tickers),
                stocks_ok=stocks_ok,
                stocks_failed=stocks_failed,
                start_time=start_time,
                fallback_used=fallback_used,
                credits_used=credits_used
            )

        except Exception as e:
            logger.error(f"Tier 1 ingestion failed: {e}")
            return self._build_result(run_type, "failed", 0, 0, 0, start_time, error_detail=str(e))

    def _persist_prices(self, prices: List[StockPrice]):
        if not prices:
            return
            
        client = _get_client()
        market_date = datetime.now(timezone.utc).date().isoformat()
        
        # Upsert stock_prices
        records = []
        for p in prices:
            rec = {
                "ticker": p.ticker,
                "price": p.price,
                "source": p.source,
                "fetched_at": p.fetched_at,
                "market_date": market_date
            }
            if p.open_price: rec["open_price"] = p.open_price
            if p.high: rec["high"] = p.high
            if p.low: rec["low"] = p.low
            if p.volume: rec["volume"] = p.volume
            records.append(rec)

        try:
            # We don't have a direct upsert on (ticker, fetched_at) easily without knowing constraints,
            # but we can insert.
            client.table("stock_prices").insert(records).execute()
        except Exception as e:
            logger.error(f"Failed to persist prices: {e}")

    def _update_last_price_update(self, prices: List[StockPrice]):
        if not prices:
            return
            
        client = _get_client()
        now = datetime.now(timezone.utc).isoformat()
        
        # Update last_price_update in stock_meta
        # Need to do it iteratively or bulk if supported. Iterative for now.
        for p in prices:
            try:
                client.table("stock_meta").update({"last_price_update": now}).eq("ticker", p.ticker).execute()
            except Exception as e:
                pass # Non-critical

    def _build_result(
        self,
        run_type: str,
        status: str,
        stocks_total: int,
        stocks_ok: int,
        stocks_failed: int,
        start_time: datetime,
        fallback_used: int = 0,
        credits_used: int = 0,
        error_detail: str = None
    ) -> IngestionResult:
        finished_at = datetime.now(timezone.utc)
        
        result = IngestionResult(
            run_type=run_type,
            status=status,
            stocks_total=stocks_total,
            stocks_ok=stocks_ok,
            stocks_failed=stocks_failed,
            fallback_used=fallback_used,
            credits_used=credits_used,
            error_detail=error_detail
        )
        
        # Log to DB
        try:
            client = _get_client()
            client.table("ingestion_log").insert({
                "run_type": run_type,
                "started_at": start_time.isoformat(),
                "finished_at": finished_at.isoformat(),
                "status": status,
                "stocks_total": stocks_total,
                "stocks_ok": stocks_ok,
                "stocks_failed": stocks_failed,
                "fallback_used": fallback_used,
                "credits_used": credits_used,
                "error_detail": error_detail,
                "metadata": {}
            }).execute()
        except Exception as e:
            logger.error(f"Failed to save ingestion log: {e}")
            
        return result
