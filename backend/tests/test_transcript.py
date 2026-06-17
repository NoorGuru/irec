"""Tests for the transcript fetcher module."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.transcript import fetch_transcript


class FakeSnippet:
    """Mimics a transcript snippet with a .text attribute."""

    def __init__(self, text: str):
        self.text = text


class FakeResult:
    """Mimics the result of api.fetch() with a .snippets attribute."""

    def __init__(self, snippets: list[FakeSnippet]):
        self.snippets = snippets


async def _fake_to_thread(fn, *args, **kwargs):
    """Replacement for asyncio.to_thread that calls fn synchronously."""
    return fn(*args, **kwargs)


@pytest.mark.asyncio
async def test_fetch_transcript_success():
    """Test successful transcript retrieval and concatenation."""
    fake_result = FakeResult([
        FakeSnippet("Hello everyone"),
        FakeSnippet("today we discuss stocks"),
        FakeSnippet("like AAPL and TSLA"),
    ])

    with patch("app.transcript._build_api") as mock_build:
        mock_api = MagicMock()
        mock_api.fetch.return_value = fake_result
        mock_build.return_value = mock_api

        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            result = await fetch_transcript("abc123xyz99")

    mock_api.fetch.assert_called_once_with("abc123xyz99", languages=["en", "en-US", "en-GB"])
    assert result == "Hello everyone today we discuss stocks like AAPL and TSLA"


@pytest.mark.asyncio
async def test_fetch_transcript_single_segment():
    """Test transcript with a single segment."""
    fake_result = FakeResult([FakeSnippet("Short video")])

    with patch("app.transcript._build_api") as mock_build:
        mock_api = MagicMock()
        mock_api.fetch.return_value = fake_result
        mock_build.return_value = mock_api

        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            result = await fetch_transcript("abc123xyz99")

    assert result == "Short video"


@pytest.mark.asyncio
async def test_fetch_transcript_transcripts_disabled():
    """Test 422 when transcripts are disabled for the video."""
    from youtube_transcript_api._errors import TranscriptsDisabled

    with patch("app.transcript._build_api") as mock_build:
        mock_api = MagicMock()
        mock_api.fetch.side_effect = TranscriptsDisabled("abc123xyz99")
        # Fallback also fails
        mock_api.list.side_effect = Exception("No transcripts")
        mock_build.return_value = mock_api

        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            with pytest.raises(HTTPException) as exc_info:
                await fetch_transcript("abc123xyz99")

    assert exc_info.value.status_code == 422
    assert "Transcript unavailable" in exc_info.value.detail


@pytest.mark.asyncio
async def test_fetch_transcript_no_transcript_found():
    """Test 422 when no English transcript is found."""
    from youtube_transcript_api._errors import NoTranscriptFound

    with patch("app.transcript._build_api") as mock_build:
        mock_api = MagicMock()
        mock_api.fetch.side_effect = NoTranscriptFound(
            "abc123xyz99", ["de", "fr"], MagicMock()
        )
        mock_api.list.side_effect = Exception("No transcripts")
        mock_build.return_value = mock_api

        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            with pytest.raises(HTTPException) as exc_info:
                await fetch_transcript("abc123xyz99")

    assert exc_info.value.status_code == 422
    assert "Transcript unavailable" in exc_info.value.detail


@pytest.mark.asyncio
async def test_fetch_transcript_space_separator():
    """Test that segments are joined with a single space separator."""
    fake_result = FakeResult([
        FakeSnippet("word1"),
        FakeSnippet("word2"),
        FakeSnippet("word3"),
    ])

    with patch("app.transcript._build_api") as mock_build:
        mock_api = MagicMock()
        mock_api.fetch.return_value = fake_result
        mock_build.return_value = mock_api

        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            result = await fetch_transcript("abc123xyz99")

    assert result == "word1 word2 word3"
    assert "  " not in result


@pytest.mark.asyncio
async def test_fetch_transcript_retries_on_rate_limit():
    """Test retry logic on retryable errors."""
    fake_result = FakeResult([FakeSnippet("Success after retry")])

    call_count = 0

    def fetch_with_failure(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("429 Too Many Requests")
        return fake_result

    retry_calls: list[tuple] = []

    def on_retry(attempt, max_retries, error, delay):
        retry_calls.append((attempt, max_retries, error, delay))

    with patch("app.transcript._build_api") as mock_build:
        mock_api = MagicMock()
        mock_api.fetch.side_effect = fetch_with_failure
        mock_build.return_value = mock_api

        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            with patch("app.transcript.asyncio.sleep", new=AsyncMock()):
                result = await fetch_transcript("abc123xyz99", on_retry=on_retry)

    assert result == "Success after retry"
    assert len(retry_calls) == 1
    assert retry_calls[0][0] == 1  # attempt 1
