from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class StockPrice(BaseModel):
    ticker: str
    price: float
    open_price: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[int] = None
    source: str = "yfinance"  # twelvedata or yfinance
    fetched_at: str  # ISO 8601

class IngestionResult(BaseModel):
    run_type: str
    status: str
    stocks_total: int = 0
    stocks_ok: int = 0
    stocks_failed: int = 0
    fallback_used: int = 0
    credits_used: int = 0
    error_detail: Optional[str] = None
    metadata: Dict[str, Any] = {}

class RerankResult(BaseModel):
    promoted: List[str]
    demoted: List[str]
    pinned: List[str]
