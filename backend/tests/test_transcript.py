"""Tests for the transcript fetcher module."""

import pytest
from unittest.mock import patch, MagicMock

from app.transcript import fetch_transcript


def test_fetch_transcript_success():
    """Test successful transcript retrieval and concatenation."""
    mock_transcript = [
        {"text": "Hello everyone", "start": 0.0, "duration": 2.0},
        {"text": "today we discuss stocks", "start": 2.0, "duration": 3.0},
        {"text": "like AAPL and TSLA", "start": 5.0, "duration": 2.5},
    ]

    with patch(
        "app.transcript.YouTubeTranscriptApi.get_transcript",
        return_value=mock_transcript,
    ) as mock_get:
        result = fetch_transcript("abc123xyz99")

    mock_get.assert_called_once_with("abc123xyz99", languages=["en"])
    assert result == "Hello everyone today we discuss stocks like AAPL and TSLA"


def test_fetch_transcript_single_segment():
    """Test transcript with a single segment."""
    mock_transcript = [
        {"text": "Short video", "start": 0.0, "duration": 1.0},
    ]

    with patch(
        "app.transcript.YouTubeTranscriptApi.get_transcript",
        return_value=mock_transcript,
    ):
        result = fetch_transcript("abc123xyz99")

    assert result == "Short video"


def test_fetch_transcript_transcripts_disabled():
    """Test 422 when transcripts are disabled for the video."""
    from youtube_transcript_api._errors import TranscriptsDisabled

    with patch(
        "app.transcript.YouTubeTranscriptApi.get_transcript",
        side_effect=TranscriptsDisabled("abc123xyz99"),
    ):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            fetch_transcript("abc123xyz99")

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail == "Transcript unavailable for this video"


def test_fetch_transcript_no_transcript_found():
    """Test 422 when no English transcript is found."""
    from youtube_transcript_api._errors import NoTranscriptFound

    with patch(
        "app.transcript.YouTubeTranscriptApi.get_transcript",
        side_effect=NoTranscriptFound(
            "abc123xyz99", ["de", "fr"], MagicMock()
        ),
    ):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            fetch_transcript("abc123xyz99")

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail == "Transcript unavailable for this video"


def test_fetch_transcript_space_separator():
    """Test that segments are joined with a single space separator."""
    mock_transcript = [
        {"text": "word1", "start": 0.0, "duration": 1.0},
        {"text": "word2", "start": 1.0, "duration": 1.0},
        {"text": "word3", "start": 2.0, "duration": 1.0},
    ]

    with patch(
        "app.transcript.YouTubeTranscriptApi.get_transcript",
        return_value=mock_transcript,
    ):
        result = fetch_transcript("abc123xyz99")

    # Verify exactly one space between each segment
    assert result == "word1 word2 word3"
    assert "  " not in result
