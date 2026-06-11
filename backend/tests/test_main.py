"""Integration tests for the extraction endpoint."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas import ParsedURL, Recommendation, VideoMetadata


@pytest.fixture
def valid_token_header():
    return {"Authorization": "Bearer valid-token"}


@pytest.fixture
def mock_verify_owner():
    """Override the verify_owner dependency to always succeed."""
    from app.auth import verify_owner

    async def _override():
        return "owner@example.com"

    app.dependency_overrides[verify_owner] = _override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_pipeline():
    """Mock all pipeline dependencies for a successful extraction."""
    parsed = ParsedURL(video_id="abc123xyz99", canonical_url="https://www.youtube.com/watch?v=abc123xyz99")
    metadata = VideoMetadata(channel_name="Financial Education", published_at="2024-01-15T10:30:00Z")
    recommendations = [
        Recommendation(
            ticker="AAPL",
            sentiment=2,
            target_price=200.0,
            conviction_level=8,
            catalyst_notes="Strong iPhone sales expected",
        ),
        Recommendation(
            ticker="TSLA",
            sentiment=1,
            target_price=None,
            conviction_level=5,
            catalyst_notes="EV market growth",
        ),
    ]

    with (
        patch("app.main.parse_url", return_value=parsed) as mock_parse,
        patch("app.main.check_duplicate", new_callable=AsyncMock, return_value=False) as mock_dup,
        patch("app.main.fetch_metadata", new_callable=AsyncMock, return_value=metadata) as mock_meta,
        patch("app.main.fetch_transcript", return_value="some transcript text") as mock_trans,
        patch("app.main.parse_recommendations", new_callable=AsyncMock, return_value=recommendations) as mock_llm,
        patch("app.main.persist_extraction", new_callable=AsyncMock, return_value={"channel_id": "uuid1", "video_id": "uuid2"}) as mock_db,
    ):
        yield {
            "parse_url": mock_parse,
            "check_duplicate": mock_dup,
            "fetch_metadata": mock_meta,
            "fetch_transcript": mock_trans,
            "parse_recommendations": mock_llm,
            "persist_extraction": mock_db,
        }


@pytest.mark.asyncio
async def test_extract_success(mock_verify_owner, mock_pipeline):
    """Test successful extraction returns 201 with correct response body."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/v1/extract",
            json={"youtube_url": "https://www.youtube.com/watch?v=abc123xyz99"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["channel_name"] == "Financial Education"
    assert data["video_id"] == "abc123xyz99"
    assert data["published_at"] == "2024-01-15T10:30:00Z"
    assert data["tickers_extracted"] == ["AAPL", "TSLA"]
    assert data["recommendation_count"] == 2


@pytest.mark.asyncio
async def test_extract_missing_body(mock_verify_owner):
    """Test missing request body returns 422."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/extract", content="")

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_extract_invalid_body(mock_verify_owner):
    """Test invalid request body (missing youtube_url) returns 422."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/v1/extract",
            json={"wrong_field": "value"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_extract_duplicate_video(mock_verify_owner):
    """Test duplicate video returns 409."""
    parsed = ParsedURL(video_id="abc123xyz99", canonical_url="https://www.youtube.com/watch?v=abc123xyz99")

    with (
        patch("app.main.parse_url", return_value=parsed),
        patch("app.main.check_duplicate", new_callable=AsyncMock, return_value=True),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/extract",
                json={"youtube_url": "https://www.youtube.com/watch?v=abc123xyz99"},
            )

    assert response.status_code == 409
    assert response.json()["detail"] == "Video already processed"


@pytest.mark.asyncio
async def test_extract_no_auth():
    """Test request without auth returns 401."""
    # Clear any overrides to test real auth
    app.dependency_overrides.clear()

    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": "secret", "OWNER_EMAIL": "owner@example.com"}):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/extract",
                json={"youtube_url": "https://www.youtube.com/watch?v=abc123xyz99"},
            )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_extract_pipeline_order(mock_verify_owner, mock_pipeline):
    """Test that pipeline steps are called in correct order with correct arguments."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await client.post(
            "/api/v1/extract",
            json={"youtube_url": "https://www.youtube.com/watch?v=abc123xyz99"},
        )

    # Verify parse_url was called with the URL
    mock_pipeline["parse_url"].assert_called_once_with("https://www.youtube.com/watch?v=abc123xyz99")

    # Verify duplicate check with video_id
    mock_pipeline["check_duplicate"].assert_called_once_with("abc123xyz99")

    # Verify metadata fetch with video_id
    mock_pipeline["fetch_metadata"].assert_called_once_with("abc123xyz99")

    # Verify transcript fetch with video_id
    mock_pipeline["fetch_transcript"].assert_called_once_with("abc123xyz99")

    # Verify LLM called with transcript and metadata
    mock_pipeline["parse_recommendations"].assert_called_once()
    call_args = mock_pipeline["parse_recommendations"].call_args
    assert call_args[0][0] == "some transcript text"
    assert call_args[0][1].channel_name == "Financial Education"

    # Verify persist was called with correct data
    mock_pipeline["persist_extraction"].assert_called_once_with(
        channel_name="Financial Education",
        youtube_video_id="abc123xyz99",
        video_url="https://www.youtube.com/watch?v=abc123xyz99",
        published_at="2024-01-15T10:30:00Z",
        recommendations=mock_pipeline["parse_recommendations"].return_value,
    )


@pytest.mark.asyncio
async def test_extract_empty_recommendations(mock_verify_owner):
    """Test extraction with no recommendations still returns 201."""
    parsed = ParsedURL(video_id="abc123xyz99", canonical_url="https://www.youtube.com/watch?v=abc123xyz99")
    metadata = VideoMetadata(channel_name="Tech Channel", published_at="2024-02-01T08:00:00Z")

    with (
        patch("app.main.parse_url", return_value=parsed),
        patch("app.main.check_duplicate", new_callable=AsyncMock, return_value=False),
        patch("app.main.fetch_metadata", new_callable=AsyncMock, return_value=metadata),
        patch("app.main.fetch_transcript", return_value="just some discussion"),
        patch("app.main.parse_recommendations", new_callable=AsyncMock, return_value=[]),
        patch("app.main.persist_extraction", new_callable=AsyncMock, return_value={"channel_id": "uuid1", "video_id": "uuid2"}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/extract",
                json={"youtube_url": "https://www.youtube.com/watch?v=abc123xyz99"},
            )

    assert response.status_code == 201
    data = response.json()
    assert data["tickers_extracted"] == []
    assert data["recommendation_count"] == 0


@pytest.mark.asyncio
async def test_extract_database_error(mock_verify_owner):
    """Test database error during persistence returns 500."""
    parsed = ParsedURL(video_id="abc123xyz99", canonical_url="https://www.youtube.com/watch?v=abc123xyz99")
    metadata = VideoMetadata(channel_name="Channel", published_at="2024-01-01T00:00:00Z")

    with (
        patch("app.main.parse_url", return_value=parsed),
        patch("app.main.check_duplicate", new_callable=AsyncMock, return_value=False),
        patch("app.main.fetch_metadata", new_callable=AsyncMock, return_value=metadata),
        patch("app.main.fetch_transcript", return_value="transcript"),
        patch("app.main.parse_recommendations", new_callable=AsyncMock, return_value=[]),
        patch("app.main.persist_extraction", new_callable=AsyncMock, side_effect=HTTPException(status_code=500, detail="Internal error, please try again")),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/extract",
                json={"youtube_url": "https://www.youtube.com/watch?v=abc123xyz99"},
            )

    assert response.status_code == 500


@pytest.mark.asyncio
async def test_cors_headers():
    """Test CORS middleware is configured properly."""
    from app.main import app as test_app
    middleware_classes = [m.cls.__name__ for m in test_app.user_middleware]
    assert "CORSMiddleware" in middleware_classes


@pytest.mark.asyncio
async def test_extract_structured_error_logging(mock_verify_owner):
    """Test that pipeline errors are logged with structured context."""
    parsed = ParsedURL(video_id="abc123xyz99", canonical_url="https://www.youtube.com/watch?v=abc123xyz99")

    with (
        patch("app.main.parse_url", return_value=parsed),
        patch("app.main.check_duplicate", new_callable=AsyncMock, return_value=False),
        patch("app.main.fetch_metadata", new_callable=AsyncMock, side_effect=HTTPException(status_code=502, detail="Could not retrieve video metadata")),
        patch("app.main._log_pipeline_error") as mock_log,
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/extract",
                json={"youtube_url": "https://www.youtube.com/watch?v=abc123xyz99"},
            )

    assert response.status_code == 502
    # Verify structured logging was called with correct pipeline stage
    mock_log.assert_called_once()
    call_args = mock_log.call_args[0]
    assert call_args[0] == "https://www.youtube.com/watch?v=abc123xyz99"
    assert call_args[1] == "metadata_fetch"
