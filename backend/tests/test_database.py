"""Unit tests for the database service module."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.database import (
    _rollback_video,
    check_duplicate,
    insert_recommendations,
    insert_video,
    persist_extraction,
    upsert_channel,
)
from app.schemas import Recommendation


# --- Fixtures ---


@pytest.fixture(autouse=True)
def reset_client():
    """Reset the global client before each test."""
    import app.database as db_module

    db_module._client = None
    yield
    db_module._client = None


@pytest.fixture
def mock_client():
    """Create a mock Supabase client."""
    with patch("app.database._get_client") as mock_get:
        client = MagicMock()
        mock_get.return_value = client
        yield client


@pytest.fixture
def sample_recommendations():
    """Create sample Recommendation objects for testing."""
    return [
        Recommendation(
            ticker="AAPL",
            sentiment=2,
            target_price=200.0,
            conviction_level=8,
            catalyst_notes="Strong iPhone sales expected",
        ),
        Recommendation(
            ticker="TSLA",
            sentiment=-1,
            target_price=None,
            conviction_level=5,
            catalyst_notes="Margin pressure concerns",
        ),
    ]


# --- check_duplicate tests ---


@pytest.mark.asyncio
async def test_check_duplicate_returns_true_when_exists(mock_client):
    """Duplicate check returns True when video exists."""
    mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"video_id": str(uuid.uuid4())}]
    )
    result = await check_duplicate("abc123xyz99")
    assert result is True
    mock_client.table.assert_called_with("videos")


@pytest.mark.asyncio
async def test_check_duplicate_returns_false_when_not_exists(mock_client):
    """Duplicate check returns False when video does not exist."""
    mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[]
    )
    result = await check_duplicate("newvideo1234")
    assert result is False


@pytest.mark.asyncio
async def test_check_duplicate_raises_503_on_error(mock_client):
    """Duplicate check raises 503 on database error."""
    mock_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception(
        "Connection timeout"
    )
    with pytest.raises(HTTPException) as exc_info:
        await check_duplicate("abc123xyz99")
    assert exc_info.value.status_code == 503
    assert "Database service temporarily unavailable" in exc_info.value.detail


# --- upsert_channel tests ---


@pytest.mark.asyncio
async def test_upsert_channel_returns_channel_id(mock_client):
    """Upsert channel returns the channel_id UUID."""
    channel_id = str(uuid.uuid4())
    mock_client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"channel_id": channel_id, "channel_name": "TestChannel"}]
    )
    result = await upsert_channel("TestChannel")
    assert result == channel_id
    mock_client.table.assert_called_with("channels")


@pytest.mark.asyncio
async def test_upsert_channel_raises_500_on_empty_response(mock_client):
    """Upsert channel raises 500 if no data returned."""
    mock_client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[]
    )
    with pytest.raises(HTTPException) as exc_info:
        await upsert_channel("TestChannel")
    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_upsert_channel_raises_503_on_timeout(mock_client):
    """Upsert channel raises 503 on timeout."""
    mock_client.table.return_value.upsert.return_value.execute.side_effect = Exception(
        "Timeout"
    )
    with pytest.raises(HTTPException) as exc_info:
        await upsert_channel("TestChannel")
    assert exc_info.value.status_code == 503


# --- insert_video tests ---


@pytest.mark.asyncio
async def test_insert_video_returns_video_id(mock_client):
    """Insert video returns the video_id UUID."""
    video_id = str(uuid.uuid4())
    channel_id = str(uuid.uuid4())
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"video_id": video_id}]
    )
    result = await insert_video(
        youtube_video_id="abc123xyz99",
        video_url="https://www.youtube.com/watch?v=abc123xyz99",
        channel_id=channel_id,
        published_at="2024-01-15T10:30:00Z",
    )
    assert result == video_id


@pytest.mark.asyncio
async def test_insert_video_raises_500_on_empty_response(mock_client):
    """Insert video raises 500 if no data returned."""
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[]
    )
    with pytest.raises(HTTPException) as exc_info:
        await insert_video(
            youtube_video_id="abc123xyz99",
            video_url="https://www.youtube.com/watch?v=abc123xyz99",
            channel_id=str(uuid.uuid4()),
            published_at="2024-01-15T10:30:00Z",
        )
    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_insert_video_raises_500_on_error(mock_client):
    """Insert video raises 500 on database error."""
    mock_client.table.return_value.insert.return_value.execute.side_effect = Exception(
        "Unique constraint violation"
    )
    with pytest.raises(HTTPException) as exc_info:
        await insert_video(
            youtube_video_id="abc123xyz99",
            video_url="https://www.youtube.com/watch?v=abc123xyz99",
            channel_id=str(uuid.uuid4()),
            published_at="2024-01-15T10:30:00Z",
        )
    assert exc_info.value.status_code == 500


# --- insert_recommendations tests ---


@pytest.mark.asyncio
async def test_insert_recommendations_inserts_batch(mock_client, sample_recommendations):
    """Insert recommendations performs batch insert."""
    video_id = str(uuid.uuid4())
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{}]
    )
    await insert_recommendations(video_id, sample_recommendations)
    mock_client.table.assert_called_with("recommendations")
    insert_call = mock_client.table.return_value.insert.call_args[0][0]
    assert len(insert_call) == 2
    assert insert_call[0]["ticker"] == "AAPL"
    assert insert_call[1]["ticker"] == "TSLA"


@pytest.mark.asyncio
async def test_insert_recommendations_skips_empty_list(mock_client):
    """Insert recommendations does nothing for empty list."""
    video_id = str(uuid.uuid4())
    await insert_recommendations(video_id, [])
    mock_client.table.assert_not_called()


@pytest.mark.asyncio
async def test_insert_recommendations_raises_500_on_error(
    mock_client, sample_recommendations
):
    """Insert recommendations raises 500 on database error."""
    video_id = str(uuid.uuid4())
    mock_client.table.return_value.insert.return_value.execute.side_effect = Exception(
        "DB error"
    )
    with pytest.raises(HTTPException) as exc_info:
        await insert_recommendations(video_id, sample_recommendations)
    assert exc_info.value.status_code == 500


# --- persist_extraction tests ---


@pytest.mark.asyncio
async def test_persist_extraction_full_flow(mock_client, sample_recommendations):
    """persist_extraction orchestrates channel upsert, video insert, and recommendations."""
    channel_id = str(uuid.uuid4())
    video_id = str(uuid.uuid4())

    # Mock upsert_channel
    mock_client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"channel_id": channel_id}]
    )
    # Mock insert_video
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"video_id": video_id}]
    )

    result = await persist_extraction(
        channel_name="Financial Education",
        youtube_video_id="abc123xyz99",
        video_url="https://www.youtube.com/watch?v=abc123xyz99",
        published_at="2024-01-15T10:30:00Z",
        recommendations=sample_recommendations,
    )
    assert result["channel_id"] == channel_id
    assert result["video_id"] == video_id


@pytest.mark.asyncio
async def test_persist_extraction_empty_recommendations(mock_client):
    """persist_extraction still inserts channel and video with empty recommendations."""
    channel_id = str(uuid.uuid4())
    video_id = str(uuid.uuid4())

    mock_client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"channel_id": channel_id}]
    )
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"video_id": video_id}]
    )

    result = await persist_extraction(
        channel_name="Financial Education",
        youtube_video_id="abc123xyz99",
        video_url="https://www.youtube.com/watch?v=abc123xyz99",
        published_at="2024-01-15T10:30:00Z",
        recommendations=[],
    )
    assert result["channel_id"] == channel_id
    assert result["video_id"] == video_id


@pytest.mark.asyncio
async def test_persist_extraction_rollback_on_recommendations_failure(mock_client):
    """persist_extraction rolls back video when recommendations insert fails."""
    channel_id = str(uuid.uuid4())
    video_id = str(uuid.uuid4())

    mock_client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"channel_id": channel_id}]
    )

    # Track calls to distinguish insert_video from insert_recommendations
    call_count = {"insert": 0}
    original_insert = mock_client.table.return_value.insert

    def side_effect_insert(data):
        call_count["insert"] += 1
        result = MagicMock()
        if call_count["insert"] == 1:
            # First insert is the video - succeeds
            result.execute.return_value = MagicMock(data=[{"video_id": video_id}])
        else:
            # Second insert is recommendations - fails
            result.execute.side_effect = Exception("DB error on recommendations")
        return result

    mock_client.table.return_value.insert.side_effect = side_effect_insert

    # Mock delete for rollback
    mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()

    recommendations = [
        Recommendation(
            ticker="AAPL",
            sentiment=1,
            conviction_level=7,
            catalyst_notes="Test catalyst",
        )
    ]

    with pytest.raises(HTTPException) as exc_info:
        await persist_extraction(
            channel_name="Test Channel",
            youtube_video_id="abc123xyz99",
            video_url="https://www.youtube.com/watch?v=abc123xyz99",
            published_at="2024-01-15T10:30:00Z",
            recommendations=recommendations,
        )
    assert exc_info.value.status_code == 500


# --- _get_client tests ---


def test_get_client_raises_500_without_env_vars():
    """_get_client raises 500 when env vars are missing."""
    import app.database as db_module

    db_module.SUPABASE_URL = None
    db_module.SUPABASE_SERVICE_KEY = None
    db_module._client = None

    with pytest.raises(HTTPException) as exc_info:
        db_module._get_client()
    assert exc_info.value.status_code == 500
