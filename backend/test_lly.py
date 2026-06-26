import sys
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import _get_client

client = _get_client()
res = client.table("recommendations").select("*, videos!inner(*, channels(*))").eq("ticker", "LLY").execute()
print(f"Found {len(res.data)} recommendations for LLY")
for d in res.data:
    print(f"- published: {d['videos']['published_at']}, sentiment: {d['sentiment']}, conviction: {d['conviction_level']}")
