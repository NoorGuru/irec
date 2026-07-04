"""Routes for portfolio integration."""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
import httpx
from jose import jwt

from app.auth import verify_owner
from app.database import _get_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/portfolio", tags=["portfolio"])

@router.get("/")
async def get_portfolio(
    authorization: str = Header(None),
    _owner_email: str = Depends(verify_owner)
):
    """Get the user's synced portfolio."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization[len("Bearer "):]
    supabase_jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
    
    try:
        payload = jwt.decode(
            token,
            supabase_jwt_secret,
            algorithms=["HS256", "RS256", "EdDSA", "ES256"],
            options={"verify_aud": False, "verify_signature": False},
        )
        user_id = payload.get("sub")
    except Exception as e:
        logger.error(f"JWT decode error in get_portfolio: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    supabase = _get_client()
    resp = supabase.table("user_portfolio").select("ticker, shares, average_cost, updated_at").eq("user_id", user_id).execute()
    
    return {"status": "success", "portfolio": resp.data or []}

class SyncRequest(BaseModel):
    provider_token: str

@router.post("/sync")
async def sync_portfolio(
    request: SyncRequest,
    authorization: str = Header(None),
    _owner_email: str = Depends(verify_owner)
):
    """Sync portfolio from Google Sheets using the provider token."""
    # 1. Get user_id from token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization[len("Bearer "):]
    supabase_jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
    
    try:
        payload = jwt.decode(
            token,
            supabase_jwt_secret,
            algorithms=["HS256", "RS256", "EdDSA", "ES256"],
            options={"verify_aud": False, "verify_signature": False},
        )
        user_id = payload.get("sub")
    except Exception as e:
        logger.error(f"JWT decode error in portfolio sync: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    # 2. Fetch Google Sheet data using provider_token
    SHEET_ID = "1eYUWaGpmZ9DMEs_UXJKQjnrFg9mN5mC0HzwQn9AN6F0"
    SHEET_RANGE = "Global_Equities" 
    
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{SHEET_RANGE}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {request.provider_token}"}
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            import traceback
            error_detail = "Failed to fetch Google Sheet."
            if 'resp' in locals() and hasattr(resp, 'text'):
                error_detail += f" Google API responded with: {resp.text}"
            else:
                error_detail += f" Error: {repr(e)}\n{traceback.format_exc()}"
                
            logger.error(error_detail)
            with open("last_sync_error.txt", "w") as f:
                f.write(error_detail)
            raise HTTPException(status_code=400, detail=error_detail)

    values = data.get("values", [])
    if not values:
        return {"status": "success", "message": "Sheet is empty", "tickers_synced": 0}

    # 3. Parse the data
    headers = [str(h).lower().strip() for h in values[0]]
    
    ticker_idx = 0
    for idx, h in enumerate(headers):
        if 'ticker' in h or 'symbol' in h:
            ticker_idx = idx
            break
            
    shares_idx = -1
    for idx, h in enumerate(headers):
        if 'share' in h or 'qty' in h or 'quantity' in h:
            shares_idx = idx
            break
            
    cost_idx = -1
    for idx, h in enumerate(headers):
        if 'cost' in h or 'avg' in h or 'price' in h:
            cost_idx = idx
            break

    # 4. Insert/Upsert into Supabase user_portfolio
    supabase = _get_client()
    
    # Delete existing portfolio for a clean sync
    try:
        supabase.table("user_portfolio").delete().eq("user_id", user_id).execute()
    except Exception as e:
        logger.warning(f"Error clearing old portfolio: {e}")

    TICKER_MAP = {
        "GOOG": "GOOGL",
        "BRK.B": "BRK-B",
        "BRK/B": "BRK-B"
    }

    portfolio_agg = {}
    
    for row in values[1:]:
        if not row or len(row) <= ticker_idx:
            continue
        ticker = row[ticker_idx].strip().upper()
        if not ticker or ticker == 'TOTAL':
            continue
            
        ticker = TICKER_MAP.get(ticker, ticker)
            
        shares = 0.0
        if shares_idx != -1 and len(row) > shares_idx:
            try:
                val = str(row[shares_idx]).replace(',', '').strip()
                if val:
                    shares = float(val)
            except Exception:
                pass
                
        cost = 0.0
        if cost_idx != -1 and len(row) > cost_idx:
            try:
                val = str(row[cost_idx]).replace(',', '').replace('$', '').strip()
                if val:
                    cost = float(val)
            except Exception:
                pass

        if ticker not in portfolio_agg:
            portfolio_agg[ticker] = {"shares": 0.0, "total_cost": 0.0}
            
        portfolio_agg[ticker]["shares"] += shares
        portfolio_agg[ticker]["total_cost"] += (shares * cost)

    inserts = []
    for ticker, data in portfolio_agg.items():
        avg_cost = None
        if data["shares"] > 0:
            avg_cost = data["total_cost"] / data["shares"]
            
        inserts.append({
            "user_id": user_id,
            "ticker": ticker,
            "shares": data["shares"] if data["shares"] > 0 else None,
            "average_cost": round(avg_cost, 2) if avg_cost is not None else None,
        })

    if inserts:
        try:
            supabase.table("user_portfolio").upsert(inserts, on_conflict="user_id, ticker").execute()
        except Exception as e:
            logger.error(f"Database insert error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save to database. Did you run the SQL migration? Error: {e}"
            )

    return {
        "status": "success", 
        "tickers_synced": len(inserts),
        "message": f"Successfully synced {len(inserts)} tickers from 'Global_Equities'."
    }
