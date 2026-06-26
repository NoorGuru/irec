import asyncio
import os
import sys

# Ensure backend directory is in the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import _get_client
from app.radars_schemas import RadarDefinition

# The hardcoded radars to migrate
RADARS = [
    RadarDefinition(
        name="The Mag 7",
        slug="mag-7",
        description="The mega-cap tech giants driving major index movements.",
        tickers=["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA"],
        theme_color="#FFD700", # Golden/Purple Aura
        icon="crown"
    ),
    RadarDefinition(
        name="MANGOS",
        slug="mangos",
        description="The new AI frontier and next-gen tech leadership.",
        tickers=["META", "ANTH", "NVDA", "GOOGL", "OAI", "SPCX"],
        theme_color="#F59E0B", # Amber Aura
        icon="spark"
    ),
    RadarDefinition(
        name="AI Infrastructure",
        slug="ai-infrastructure",
        description="The hardware and foundry backbone of artificial intelligence.",
        tickers=["AMD", "SMCI", "TSM", "ASML", "ARM", "PLTR", "MU"],
        theme_color="#00FFFF", # Electric Blue Aura
        icon="microchip"
    ),
    RadarDefinition(
        name="GLP-1 & Bio",
        slug="glp-1",
        description="The massive biotech wave driven by weight-loss drugs.",
        tickers=["LLY", "NVO", "AMGN", "VKTX"],
        theme_color="#6366F1", # Indigo Aura
        icon="dna"
    ),
    RadarDefinition(
        name="Bitcoin Proxies",
        slug="crypto-proxies",
        description="Public companies acting as high-beta plays on cryptocurrency.",
        tickers=["MSTR", "COIN", "MARA", "RIOT", "IBIT"],
        theme_color="#F7931A", # Crypto Orange Aura
        icon="bitcoin"
    ),
    RadarDefinition(
        name="Defense & Aero",
        slug="defense",
        description="Aerospace and tactical contractors amidst global rearmament.",
        tickers=["LMT", "RTX", "NOC", "GD"],
        theme_color="#FFBF00", # Tactical Amber Aura
        icon="shield"
    )
]

def seed_radars():
    client = _get_client()
    
    print("Starting radar migration...")
    
    for radar in RADARS:
        # Check if radar already exists
        res = client.table("radars").select("*").eq("slug", radar.slug).execute()
        if len(res.data) > 0:
            print(f"Radar '{radar.slug}' already exists. Skipping.")
            continue
            
        print(f"Inserting Radar: {radar.name}...")
        
        # Insert radar
        radar_res = client.table("radars").insert({
            "name": radar.name,
            "slug": radar.slug,
            "description": radar.description,
            "theme_color": radar.theme_color,
            "icon": radar.icon
        }).execute()
        
        radar_id = radar_res.data[0]['id']
        
        # Insert tickers
        tickers_data = [{"radar_id": radar_id, "ticker": t} for t in radar.tickers]
        client.table("radar_tickers").insert(tickers_data).execute()
        
        print(f"  -> Added {len(tickers_data)} tickers.")
        
    print("Migration complete!")

if __name__ == "__main__":
    seed_radars()
