"""Tests for the transcript fetcher module."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.transcript import fetch_transcript, _fetch_with_retry


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
async def test_fetch_transcript_success_via_ytdlp():
    """Test successful transcript retrieval via yt-dlp (primary method)."""
    with patch(
        "app.transcript._fetch_transcript_ytdlp",
        return_value="Hello everyone today we discuss stocks like AAPL and TSLA",
    ):
        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            result = await fetch_transcript("abc123xyz99")

    assert result == "Hello everyone today we discuss stocks like AAPL and TSLA"


@pytest.mark.asyncio
async def test_fetch_transcript_single_segment_via_ytdlp():
    """Test transcript with short content via yt-dlp."""
    with patch("app.transcript._fetch_transcript_ytdlp", return_value="Short video"):
        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            result = await fetch_transcript("abc123xyz99")

    assert result == "Short video"


@pytest.mark.asyncio
async def test_fetch_transcript_falls_back_to_proxy_when_ytdlp_fails():
    """Test that proxy method is used when yt-dlp returns None."""
    fake_result = FakeResult([
        FakeSnippet("From proxy"),
        FakeSnippet("method"),
    ])

    with patch("app.transcript._fetch_transcript_ytdlp", return_value=None):
        with patch("app.transcript._build_api") as mock_build:
            mock_api = MagicMock()
            mock_api.fetch.return_value = fake_result
            mock_build.return_value = mock_api

            with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
                result = await fetch_transcript("abc123xyz99")

    assert result == "From proxy method"


@pytest.mark.asyncio
async def test_fetch_transcript_all_methods_fail():
    """Test 422 when both yt-dlp and proxy methods fail."""
    from youtube_transcript_api._errors import TranscriptsDisabled

    with patch("app.transcript._fetch_transcript_ytdlp", return_value=None):
        with patch("app.transcript._build_api") as mock_build:
            mock_api = MagicMock()
            mock_api.fetch.side_effect = TranscriptsDisabled("abc123xyz99")
            mock_api.list.side_effect = Exception("No transcripts")
            mock_build.return_value = mock_api

            with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
                with pytest.raises(HTTPException) as exc_info:
                    await fetch_transcript("abc123xyz99")

    assert exc_info.value.status_code == 422
    assert "unavailable" in exc_info.value.detail


@pytest.mark.asyncio
async def test_fetch_transcript_space_separator():
    """Test that segments are joined with a single space separator."""
    with patch(
        "app.transcript._fetch_transcript_ytdlp",
        return_value="word1 word2 word3",
    ):
        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            result = await fetch_transcript("abc123xyz99")

    assert result == "word1 word2 word3"
    assert "  " not in result


@pytest.mark.asyncio
async def test_fetch_transcript_retries_on_rate_limit():
    """Test retry logic on retryable errors (proxy path, after yt-dlp fails)."""
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

    with patch("app.transcript._fetch_transcript_ytdlp", return_value=None):
        with patch("app.transcript._build_api") as mock_build:
            mock_api = MagicMock()
            mock_api.fetch.side_effect = fetch_with_failure
            mock_build.return_value = mock_api

            with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
                with patch("app.transcript.asyncio.sleep", new=AsyncMock()):
                    result = await fetch_transcript("abc123xyz99", on_retry=on_retry)

    assert result == "Success after retry"
    # First retry call is the "yt-dlp unavailable" notification, second is the actual retry
    actual_retries = [r for r in retry_calls if r[0] > 0]
    assert len(actual_retries) == 1
    assert actual_retries[0][0] == 1  # attempt 1


@pytest.mark.asyncio
async def test_fetch_with_retry_request_blocked():
    """Test that RequestBlocked errors trigger retry with fresh proxy."""
    from app.transcript import _fetch_with_retry, RequestBlocked

    fake_result = FakeResult([FakeSnippet("Got it")])
    call_count = 0

    def fetch_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RequestBlocked("rB6hoJTQYP8")
        return fake_result

    retry_calls: list[tuple] = []

    def on_retry(attempt, max_retries, error, delay):
        retry_calls.append((attempt, max_retries, error, delay))

    with patch("app.transcript._build_api") as mock_build:
        mock_api = MagicMock()
        mock_api.fetch.side_effect = fetch_side_effect
        mock_build.return_value = mock_api

        with patch("app.transcript.asyncio.to_thread", side_effect=_fake_to_thread):
            with patch("app.transcript.asyncio.sleep", new=AsyncMock()):
                result = await _fetch_with_retry("rB6hoJTQYP8", on_retry=on_retry)

    assert " ".join(s.text for s in result.snippets) == "Got it"
    assert len(retry_calls) == 1
    assert "blocked" in retry_calls[0][2].lower()
