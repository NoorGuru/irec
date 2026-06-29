import logging
from fastapi import APIRouter, Depends, HTTPException
from app.auth import verify_cron_or_owner, verify_owner
from app.database import _get_client
from app.stock_ingestion_service import StockIngestionService
from app.tier_ranking_service import TierRankingService
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/ingestion",
    tags=["ingestion"],
)

class StockMetaUpdate(BaseModel):
    tier: int | None = None
    is_pinned: bool | None = None

# --- Ingestion Triggers ---
@router.post("/tier1_intraday", dependencies=[Depends(verify_cron_or_owner)])
async def trigger_tier1_intraday():
    svc = StockIngestionService()
    return await svc.run_tier1_intraday()

@router.post("/tier1_close", dependencies=[Depends(verify_cron_or_owner)])
async def trigger_tier1_close():
    svc = StockIngestionService()
    return await svc.run_tier1_final_close()

@router.post("/tier2_eod", dependencies=[Depends(verify_cron_or_owner)])
async def trigger_tier2_eod():
    svc = StockIngestionService()
    return await svc.run_tier2_eod()

@router.post("/rerank", dependencies=[Depends(verify_cron_or_owner)])
async def trigger_rerank():
    svc = TierRankingService()
    return await svc.refresh_stock_meta_tiers()

# --- Status & Quota (Owner only) ---
@router.get("/status", dependencies=[Depends(verify_owner)])
async def get_ingestion_status():
    client = _get_client()
    res = client.table("ingestion_log").select("*").order("started_at", desc=True).limit(50).execute()
    return res.data

@router.get("/quota", dependencies=[Depends(verify_owner)])
async def get_quota_status():
    from app.twelve_data_client import TwelveDataClient
    td = TwelveDataClient()
    remaining = await td.get_credits_remaining()
    return {
        "remaining_credits": remaining,
        "daily_limit": td.DAILY_CREDIT_CEILING
    }

# --- Tier Management (Owner only) ---
@router.get("/stock-meta", dependencies=[Depends(verify_owner)])
async def get_stock_meta():
    client = _get_client()
    res = client.table("stock_meta").select("*").order("priority_score", desc=True).execute()
    return res.data

@router.patch("/stock-meta/{ticker}", dependencies=[Depends(verify_owner)])
async def update_stock_meta(ticker: str, body: StockMetaUpdate):
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    try:
        client = _get_client()
        response = client.table("stock_meta").update(update_data).eq("ticker", ticker).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Ticker not found")
        return response.data[0]
    except Exception as e:
        logger.error(f"Failed to update stock_meta for {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
