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
    resp = supabase.table("user_portfolio").select("ticker, shares, average_cost, current_price, total_return_pct, daily_change_pct, weekly_change_pct, monthly_change_pct, ytd_return_pct, 1y_return_pct, sector, cap_size, updated_at").eq("user_id", user_id).execute()
    
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
    
    async with httpx.AsyncClient(timeout=60.0) as client:
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
            
    shares_idx = next((i for i, h in enumerate(headers) if 'share' in h or 'qty' in h or 'quantity' in h), -1)
    cost_idx = next((i for i, h in enumerate(headers) if 'avg cost' in h or 'avg' in h), -1)
    
    # New Analytics Indexes
    price_idx = next((i for i, h in enumerate(headers) if 'live price' in h or 'current price' in h), -1)
    sector_idx = next((i for i, h in enumerate(headers) if 'sector' in h), -1)
    cap_size_idx = next((i for i, h in enumerate(headers) if h == 'cap size'), -1)
    
    # Momentum Indexes
    daily_idx = next((i for i, h in enumerate(headers) if '1 day return (%)' in h), -1)
    weekly_idx = next((i for i, h in enumerate(headers) if '1 week return (%)' in h), -1)
    monthly_idx = next((i for i, h in enumerate(headers) if '1 month return (%)' in h), -1)
    ytd_idx = next((i for i, h in enumerate(headers) if 'ytd return (%)' in h), -1)
    one_year_idx = next((i for i, h in enumerate(headers) if '1 year return (%)' in h), -1)
    total_rtn_idx = next((i for i, h in enumerate(headers) if 'total gain/loss (%)' in h), -1)

    # 4. Insert/Upsert into Supabase user_portfolio
    supabase = _get_client()
    
    try:
        supabase.table("user_portfolio").delete().eq("user_id", user_id).execute()
    except Exception as e:
        logger.warning(f"Error clearing old portfolio: {e}")

    TICKER_MAP = {
        "GOOG": "GOOGL",
        "BRK.B": "BRK-B",
        "BRK/B": "BRK-B"
    }

    def safe_float(val: str, default=0.0):
        try:
            cleaned = str(val).replace(',', '').replace('$', '').replace('%', '').strip()
            return float(cleaned) if cleaned else default
        except Exception:
            return default
            
    def classify_cap_size(val_str):
        if not val_str:
            return 'Unknown'
        if any(w in val_str.lower() for w in ['mega', 'large', 'mid', 'small', 'micro']):
            return val_str
        try:
            val = float(str(val_str).replace('$', '').replace(',', '').strip())
            # If value is unscaled (e.g. 2 trillion), convert to billions
            if val > 1_000_000:
                val = val / 1_000_000_000
                
            if val >= 200:
                return 'Mega'
            elif val >= 10:
                return 'Large'
            elif val >= 2:
                return 'Mid'
            else:
                return 'Small'
        except:
            return 'Unknown'

    portfolio_agg = {}
    
    for row in values[1:]:
        if not row or len(row) <= ticker_idx:
            continue
        ticker = row[ticker_idx].strip().upper()
        if not ticker or ticker == 'TOTAL':
            continue
            
        ticker = TICKER_MAP.get(ticker, ticker)
            
        shares = safe_float(row[shares_idx]) if shares_idx != -1 and len(row) > shares_idx else 0.0
        cost = safe_float(row[cost_idx]) if cost_idx != -1 and len(row) > cost_idx else 0.0
        
        current_price = safe_float(row[price_idx]) if price_idx != -1 and len(row) > price_idx else None
        total_rtn = safe_float(row[total_rtn_idx]) if total_rtn_idx != -1 and len(row) > total_rtn_idx else None
        daily_pct = safe_float(row[daily_idx]) if daily_idx != -1 and len(row) > daily_idx else None
        weekly_pct = safe_float(row[weekly_idx]) if weekly_idx != -1 and len(row) > weekly_idx else None
        monthly_pct = safe_float(row[monthly_idx]) if monthly_idx != -1 and len(row) > monthly_idx else None
        ytd_pct = safe_float(row[ytd_idx]) if ytd_idx != -1 and len(row) > ytd_idx else None
        one_year_pct = safe_float(row[one_year_idx]) if one_year_idx != -1 and len(row) > one_year_idx else None
        
        sector = str(row[sector_idx]).strip() if sector_idx != -1 and len(row) > sector_idx else None
        
        raw_cap = str(row[cap_size_idx]).strip() if cap_size_idx != -1 and len(row) > cap_size_idx else None
        cap_size = classify_cap_size(raw_cap)

        if ticker not in portfolio_agg:
            portfolio_agg[ticker] = {
                "shares": 0.0, 
                "total_cost": 0.0,
                "current_price": current_price,
                "total_return_pct": total_rtn,
                "daily_change_pct": daily_pct,
                "weekly_change_pct": weekly_pct,
                "monthly_change_pct": monthly_pct,
                "ytd_return_pct": ytd_pct,
                "1y_return_pct": one_year_pct,
                "sector": sector,
                "cap_size": cap_size
            }
            
        portfolio_agg[ticker]["shares"] += shares
        portfolio_agg[ticker]["total_cost"] += (shares * cost)

    inserts = []
    for ticker, data in portfolio_agg.items():
        if data["shares"] <= 0:
            continue
            
        avg_cost = data["total_cost"] / data["shares"]
            
        inserts.append({
            "user_id": user_id,
            "ticker": ticker,
            "shares": data["shares"],
            "average_cost": round(avg_cost, 2),
            "current_price": data["current_price"],
            "total_return_pct": data["total_return_pct"],
            "daily_change_pct": data["daily_change_pct"],
            "weekly_change_pct": data["weekly_change_pct"],
            "monthly_change_pct": data["monthly_change_pct"],
            "ytd_return_pct": data["ytd_return_pct"],
            "1y_return_pct": data["1y_return_pct"],
            "sector": data["sector"],
            "cap_size": data["cap_size"]
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
