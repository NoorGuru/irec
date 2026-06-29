import asyncio
import os
import sys

# Ensure backend directory is in the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import _get_client
from app.tier_ranking_service import TierRankingService

# The 15 core tickers to pin
CORE_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA",
    "AMD", "PLTR", "COIN", "LLY", "CRM", "NFLX", "AVGO", "ARM"
]

async def seed_stock_meta():
    print("Starting stock_meta bootstrap...")
    client = _get_client()
    ranking_service = TierRankingService()
    
    # 1. Compute initial scores
    print("Computing initial priority scores...")
    scores = await ranking_service.compute_priority_scores()
    
    # 2. Add pinned tickers that might not have any scores
    for ticker in CORE_TICKERS:
        if ticker not in scores:
            scores[ticker] = {
                "priority_score": 0.0,
                "mention_count_30d": 0,
                "analyst_count": 0,
                "last_mentioned_at": None
            }
            
    # 3. Create meta records
    records = []
    for ticker, score_data in scores.items():
        is_pinned = ticker in CORE_TICKERS
        records.append({
            "ticker": ticker,
            "tier": 1 if is_pinned else 2,
            "is_pinned": is_pinned,
            "priority_score": score_data["priority_score"],
            "mention_count_30d": score_data["mention_count_30d"],
            "analyst_count": score_data["analyst_count"],
            "last_mentioned_at": score_data["last_mentioned_at"]
        })
        
    # 4. Insert into DB
    print(f"Upserting {len(records)} records into stock_meta...")
    for i in range(0, len(records), 100):
        batch = records[i:i+100]
        client.table("stock_meta").upsert(batch).execute()
        
    # 5. Run initial rerank to assign the remaining Tier 1 slots
    print("Running initial tier ranking...")
    result = await ranking_service.refresh_stock_meta_tiers(max_tier1=50)
    
    print(f"Bootstrap complete!")
    print(f"Pinned: {len(result.pinned)}")
    print(f"Promoted to Tier 1: {len(result.promoted)}")
    print(f"Total Tier 1: {len(result.pinned) + len(result.promoted)}")

if __name__ == "__main__":
    asyncio.run(seed_stock_meta())
