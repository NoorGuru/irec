import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def main():
    print("Updating recommendations from GOOG to GOOGL...")
    res = supabase.table("recommendations").update({"ticker": "GOOGL"}).eq("ticker", "GOOG").execute()
    print(f"Updated {len(res.data)} recommendations.")
    
    print("Updating user_portfolio from GOOG to GOOGL...")
    # There could be a conflict if a user has both GOOG and GOOGL in their portfolio. 
    # For now, let's try updating. If they have a unique constraint on (user_id, ticker), it might fail.
    try:
        res2 = supabase.table("user_portfolio").update({"ticker": "GOOGL"}).eq("ticker", "GOOG").execute()
        print(f"Updated {len(res2.data)} portfolio entries.")
    except Exception as e:
        print(f"Portfolio update had an exception: {e}")

if __name__ == "__main__":
    main()
