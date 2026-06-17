"""Tests for the metadata fetcher module."""

import pytest
import httpx
from unittest.mock import patch, AsyncMock

from app.metadata import fetch_metadata


@pytest.mark.asyncio
async def test_fetch_metadata_success():
    """Test successful metadata retrieval."""
    mock_response = httpx.Response(
        200,
        json={
            "items": [
                {
                    "snippet": {
                        "channelTitle": "Financial Education",
                        "channelId": "UC_test_channel_id",
                        "publishedAt": "2024-01-15T10:30:00Z",
                    }
                }
            ]
        },
        request=httpx.Request("GET", "https://www.googleapis.com/youtube/v3/videos"),
    )

    with patch("app.metadata.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_cls.return_value = mock_client

        result = await fetch_metadata("abc123xyz99")

    assert result.channel_name == "Financial Education"
    assert result.youtube_channel_id == "UC_test_channel_id"
    assert result.published_at == "2024-01-15T10:30:00Z"


@pytest.mark.asyncio
async def test_fetch_metadata_video_not_found():
    """Test 404 when video does not exist on YouTube."""
    mock_response = httpx.Response(
        200,
        json={"items": []},
        request=httpx.Request("GET", "https://www.googleapis.com/youtube/v3/videos"),
    )

    with patch("app.metadata.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_cls.return_value = mock_client

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await fetch_metadata("nonexistent1")

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Video not found on YouTube"


@pytest.mark.asyncio
async def test_fetch_metadata_api_error():
    """Test 502 when YouTube API returns an HTTP error."""
    mock_response = httpx.Response(403, json={"error": "Forbidden"})
    mock_response.request = httpx.Request("GET", "https://example.com")

    with patch("app.metadata.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_cls.return_value = mock_client

        # raise_for_status() will raise on non-2xx
        mock_client.get.side_effect = httpx.HTTPStatusError(
            "Forbidden", request=mock_response.request, response=mock_response
        )

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await fetch_metadata("abc123xyz99")

        assert exc_info.value.status_code == 502
        assert exc_info.value.detail == "Could not retrieve video metadata"


@pytest.mark.asyncio
async def test_fetch_metadata_timeout():
    """Test 502 when YouTube API times out."""
    with patch("app.metadata.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.TimeoutException("Connection timed out")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_cls.return_value = mock_client

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await fetch_metadata("abc123xyz99")

        assert exc_info.value.status_code == 502
        assert exc_info.value.detail == "Could not retrieve video metadata"


@pytest.mark.asyncio
async def test_fetch_metadata_uses_correct_params():
    """Test that the correct API parameters are sent."""
    mock_response = httpx.Response(
        200,
        json={
            "items": [
                {
                    "snippet": {
                        "channelTitle": "Test Channel",
                        "channelId": "UC_test_params_id",
                        "publishedAt": "2024-06-01T00:00:00Z",
                    }
                }
            ]
        },
        request=httpx.Request("GET", "https://www.googleapis.com/youtube/v3/videos"),
    )

    with patch("app.metadata.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_cls.return_value = mock_client

        with patch("app.metadata.YOUTUBE_API_KEY", "test-api-key"):
            await fetch_metadata("testVid12345")

        call_args = mock_client.get.call_args
        assert call_args[0][0] == "https://www.googleapis.com/youtube/v3/videos"
        params = call_args[1]["params"]
        assert params["part"] == "snippet"
        assert params["id"] == "testVid12345"
        assert params["key"] == "test-api-key"
