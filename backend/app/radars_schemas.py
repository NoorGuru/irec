from typing import List, Optional
from pydantic import BaseModel

class RadarDefinition(BaseModel):
    name: str
    slug: str
    description: str
    tickers: List[str]
    theme_color: str  # Hex color for the aura
    icon: str  # Identifier for the frontend icon
    category: str  # Category for filtering

class RadarTrendPoint(BaseModel):
    date: str
    aura_score: int

class RadarResponse(BaseModel):
    name: str
    slug: str
    description: str
    tickers: List[str]
    theme_color: str
    icon: str
    category: str

    # Aggregated stats
    sentiment_pulse: float  # Simple Average Conviction mapped to sentiment
    aura_score: int
    omni_score: int
    volume: int
    latest_mention_date: Optional[str] = None
    trend: List[RadarTrendPoint]

    # List of plays for the constituent stocks
    plays: List[dict]  # Will hold PlayResponse dicts
