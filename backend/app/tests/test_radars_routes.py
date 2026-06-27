import pytest
from fastapi.testclient import TestClient
from app.main import app
from dotenv import load_dotenv
import asyncio

load_dotenv()

client = TestClient(app)

def test_get_radars():
    """Test the /api/v1/radars endpoint."""
    response = client.get("/api/v1/radars")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    for radar in data:
        assert "name" in radar
        assert "slug" in radar
        assert "tickers" in radar
        assert isinstance(radar["tickers"], list)
        assert len(radar["tickers"]) > 0
        assert "aura_score" in radar
        assert "trend" in radar
        assert isinstance(radar["trend"], list)

def test_get_radar_by_slug():
    """Test getting a specific radar by slug."""
    # First get all radars to find a valid slug
    radars_response = client.get("/api/v1/radars")
    assert radars_response.status_code == 200
    radars = radars_response.json()
    if radars:
        first_radar_slug = radars[0]["slug"]
        response = client.get(f"/api/v1/radars/{first_radar_slug}")
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == first_radar_slug