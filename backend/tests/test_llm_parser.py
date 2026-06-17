"""Tests for the LLM parser module."""

import json

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import anthropic
from fastapi import HTTPException

from app.llm_parser import calculate_backoff_delay, parse_recommendations
from app.schemas import VideoMetadata


@pytest.fixture
def metadata():
    """Sample video metadata."""
    return VideoMetadata(channel_name="TestChannel", published_at="2024-01-15T10:00:00Z")


@pytest.fixture
def valid_response_json():
    """A valid LLM response JSON string."""
    return json.dumps({
        "recommendations": [
            {
                "ticker": "AAPL",
                "sentiment": 2,
                "target_price": 200.0,
                "conviction_level": 8,
                "catalyst_notes": "Strong iPhone sales expected",
            }
        ]
    })


@pytest.fixture
def empty_response_json():
    """An empty recommendations response."""
    return json.dumps({"recommendations": []})


# --- Tests for calculate_backoff_delay ---


def test_backoff_delay_first_retry():
    """First retry (count=0) should wait 1 second."""
    assert calculate_backoff_delay(0) == 1.0


def test_backoff_delay_second_retry():
    """Second retry (count=1) should wait 2 seconds."""
    assert calculate_backoff_delay(1) == 2.0


def test_backoff_delay_third_retry():
    """Third retry (count=2) should wait 4 seconds."""
    assert calculate_backoff_delay(2) == 4.0


# --- Tests for parse_recommendations ---


@pytest.mark.asyncio
async def test_parse_recommendations_success(metadata, valid_response_json):
    """Test successful parsing of recommendations."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=valid_response_json)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("app.llm_parser._build_client", return_value=mock_client):
        result = await parse_recommendations("transcript text about stocks", metadata)

    recommendations, summary = result
    assert len(recommendations) == 1
    assert recommendations[0].ticker == "AAPL"
    assert recommendations[0].sentiment == 2
    assert recommendations[0].target_price == 200.0
    assert recommendations[0].conviction_level == 8
    assert recommendations[0].catalyst_notes == "Strong iPhone sales expected"


@pytest.mark.asyncio
async def test_parse_recommendations_empty(metadata, empty_response_json):
    """Test empty recommendations returns empty list with no error."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=empty_response_json)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("app.llm_parser._build_client", return_value=mock_client):
        result = await parse_recommendations("transcript with no stock mentions", metadata)

    recommendations, summary = result
    assert recommendations == []


@pytest.mark.asyncio
async def test_parse_recommendations_validation_retry_success(metadata, valid_response_json):
    """Test that validation failure triggers a retry and succeeds on second attempt."""
    invalid_json = "not valid json at all"

    mock_message_invalid = MagicMock()
    mock_message_invalid.content = [MagicMock(text=invalid_json)]

    mock_message_valid = MagicMock()
    mock_message_valid.content = [MagicMock(text=valid_response_json)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=[mock_message_invalid, mock_message_valid]
    )

    with patch("app.llm_parser._build_client", return_value=mock_client):
        result = await parse_recommendations("transcript text", metadata)

    recommendations, summary = result
    assert len(recommendations) == 1
    assert recommendations[0].ticker == "AAPL"
    # Two API calls total: initial + retry
    assert mock_client.messages.create.call_count == 2


@pytest.mark.asyncio
async def test_parse_recommendations_validation_failure_502(metadata):
    """Test that two validation failures raise HTTP 502."""
    invalid_json = "not valid json"

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=invalid_json)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("app.llm_parser._build_client", return_value=mock_client):
        with pytest.raises(HTTPException) as exc_info:
            await parse_recommendations("transcript text", metadata)

    assert exc_info.value.status_code == 502
    assert "Could not parse recommendations" in exc_info.value.detail


@pytest.mark.asyncio
async def test_parse_recommendations_rate_limit_retry_success(metadata, valid_response_json):
    """Test rate limit retry with exponential backoff succeeds."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=valid_response_json)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=[
            anthropic.RateLimitError.__new__(anthropic.RateLimitError),
            mock_message,
        ]
    )

    with (
        patch("app.llm_parser._build_client", return_value=mock_client),
        patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
    ):
        result = await parse_recommendations("transcript text", metadata)

    recommendations, summary = result
    assert len(recommendations) == 1
    # Should have slept for 1 second (first retry, count=0)
    mock_sleep.assert_called_once_with(1.0)


@pytest.mark.asyncio
async def test_parse_recommendations_rate_limit_exhausted_429(metadata):
    """Test that 3 rate limit errors raise HTTP 429."""
    rate_limit_error = anthropic.RateLimitError.__new__(anthropic.RateLimitError)

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=[rate_limit_error, rate_limit_error, rate_limit_error]
    )

    with (
        patch("app.llm_parser._build_client", return_value=mock_client),
        patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await parse_recommendations("transcript text", metadata)

    assert exc_info.value.status_code == 429
    assert exc_info.value.detail == "AI service busy, try again later"
    # Should have slept twice (after attempt 0 and 1, not after final attempt)
    assert mock_sleep.call_count == 2
    mock_sleep.assert_any_call(1.0)
    mock_sleep.assert_any_call(2.0)


@pytest.mark.asyncio
async def test_parse_recommendations_timeout_503(metadata):
    """Test that API timeout raises HTTP 503."""
    timeout_error = anthropic.APITimeoutError.__new__(anthropic.APITimeoutError)

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(side_effect=timeout_error)

    with patch("app.llm_parser._build_client", return_value=mock_client):
        with pytest.raises(HTTPException) as exc_info:
            await parse_recommendations("transcript text", metadata)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Service temporarily unavailable"


@pytest.mark.asyncio
async def test_parse_recommendations_includes_metadata_in_message(metadata, valid_response_json):
    """Test that channel name and publish date are included in the user message."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=valid_response_json)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("app.llm_parser._build_client", return_value=mock_client):
        await parse_recommendations("some transcript", metadata)

    call_kwargs = mock_client.messages.create.call_args.kwargs
    user_content = call_kwargs["messages"][0]["content"]
    assert "TestChannel" in user_content
    assert "2024-01-15T10:00:00Z" in user_content
    assert "some transcript" in user_content


@pytest.mark.asyncio
async def test_parse_recommendations_uses_correct_model(metadata, valid_response_json):
    """Test that the correct Claude model is used."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=valid_response_json)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("app.llm_parser._build_client", return_value=mock_client):
        await parse_recommendations("transcript", metadata)

    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-sonnet-4-20250514"
