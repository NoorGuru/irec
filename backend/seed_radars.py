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
    ),
    RadarDefinition(
        name="AI Semiconductors",
        slug="ai-semiconductors",
        description="Specialized hardware and chips designed to power AI workloads.",
        tickers=["NVDA", "AMD", "TSM", "QCOM", "ARM", "MTK"],
        theme_color="#FF00FF", # Magenta Cyan Aura
        icon="processor"
    ),
    RadarDefinition(
        name="Cloud Computing",
        slug="cloud-computing",
        description="Providers of on-demand computing services including cloud storage, servers, and AI-powered solutions.",
        tickers=["AMZN", "MSFT", "GOOGL", "CRM", "ADBE", "SNOW", "DDOG"],
        theme_color="#00FF00", # Green Blue Aura
        icon="cloud"
    ),
    RadarDefinition(
        name="Renewable Energy",
        slug="renewable-energy",
        description="Companies involved in solar, wind, battery storage, and clean energy solutions.",
        tickers=["NEE", "ENPH", "TSLA", "FSLR", "RUN"],
        theme_color="#00FF7F", # Spring Green Aura
        icon="sun"
    ),
    RadarDefinition(
        name="Dividend Aristocrats",
        slug="dividend-aristocrats",
        description="S&P 500 companies with 25+ consecutive years of dividend increases.",
        tickers=["KO", "JNJ", "PG", "MMM", "ABT", "CL", "EMR"],
        theme_color="#FFA500", # Orange Brown Aura
        icon="dollar"
    ),
    RadarDefinition(
        name="Fintech & Payments",
        slug="fintech",
        description="Technology-driven financial services and digital payment solutions.",
        tickers=["PYPL", "SQ", "V", "MA", "ADYEY", "FIS"],
        theme_color="#FF6B6B", # Red Teal Aura
        icon="creditCard"
    ),
    RadarDefinition(
        name="Emerging Markets",
        slug="emerging-markets",
        description="High-growth companies from developing economies in Asia, Latin America, and Africa.",
        tickers=["BABA", "TCEHY", "HDB", "IBN", "NU"],
        theme_color="#9C27B0", # Purple Indigo Aura
        icon="globe"
    ),
    RadarDefinition(
        name="Cybersecurity",
        slug="cybersecurity",
        description="Companies providing software, hardware, and services to protect against cyber threats.",
        tickers=["CRWD", "PANW", "ZS", "FTNT", "CSCO"],
        theme_color="#FF0000", # Red Orange Aura
        icon="lock"
    ),
    RadarDefinition(
        name="Space Technology",
        slug="space-technology",
        description="Companies involved in satellite manufacturing, launch services, and space exploration.",
        tickers=["RKLB", "ASTR", "MAXR"],
        theme_color="#00BFFF", # Deep Sky Blue Aura
        icon="satellite"
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
