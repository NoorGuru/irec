import asyncio
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import _get_client
from app.radars_routes import get_radars_from_db, compute_radar_stats, get_all_plays_data

async def snapshot_radars():
    print("Starting daily radar snapshot...")
    client = _get_client()
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"Snapshot Date: {today}")
    
    # Get all active plays today
    plays_data = await get_all_plays_data()
    all_plays = plays_data.get("plays", [])
    
    # Get radar definitions from DB
    radars_defs = await get_radars_from_db()
    
    for r_def in radars_defs:
        print(f"Processing '{r_def.name}'...")
        
        # We compute the stats without any historical trend to just get today's score
        stats = compute_radar_stats(r_def, all_plays, db_trend=[])
        
        # Upsert the score into radar_history
        # First we need the radar_id
        r_res = client.table("radars").select("id").eq("slug", r_def.slug).execute()
        if not r_res.data:
            print(f"  -> Could not find ID for {r_def.slug}")
            continue
            
        radar_id = r_res.data[0]["id"]
        
        # Prepare row
        row = {
            "radar_id": radar_id,
            "date": today,
            "aura_score": stats.aura_score,
            "omni_score": stats.omni_score,
            "sentiment_pulse": stats.sentiment_pulse,
            "volume": stats.volume
        }
        
        # Upsert (using ON CONFLICT if Supabase allows, but standard insert/update logic)
        # Check if today already exists
        check = client.table("radar_history").select("*").eq("radar_id", radar_id).eq("date", today).execute()
        
        if check.data:
            # Update
            client.table("radar_history").update(row).eq("radar_id", radar_id).eq("date", today).execute()
            print("  -> Updated existing snapshot for today.")
        else:
            # Insert
            client.table("radar_history").insert(row).execute()
            print("  -> Inserted new snapshot for today.")
            
    print("Snapshot complete!")

if __name__ == "__main__":
    asyncio.run(snapshot_radars())
