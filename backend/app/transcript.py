"""Transcript Fetcher - Retrieves and concatenates YouTube video transcripts."""

import logging
import os
import time
from collections.abc import Callable

from fastapi import HTTPException
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
)
from youtube_transcript_api.proxies import WebshareProxyConfig

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
BASE_DELAY_SECONDS = 3

# Type for an optional retry callback: (attempt, max_retries, error, delay) -> None
RetryCallback = Callable[[int, int, str, int], None] | None


def _build_api() -> YouTubeTranscriptApi:
    """Build the transcript API client, with proxy if configured."""
    proxy_user = os.environ.get("WEBSHARE_PROXY_USER")
    proxy_pass = os.environ.get("WEBSHARE_PROXY_PASS")

    if proxy_user and proxy_pass:
        # Optional: comma-separated country codes e.g. "US,GB,CA"
        locations_str = os.environ.get("WEBSHARE_PROXY_LOCATIONS", "")
        locations = [loc.strip() for loc in locations_str.split(",") if loc.strip()] or None

        proxy_config = WebshareProxyConfig(
            proxy_username=proxy_user,
            proxy_password=proxy_pass,
            filter_ip_locations=locations,
            retries_when_blocked=15,
        )
        return YouTubeTranscriptApi(proxy_config=proxy_config)

    return YouTubeTranscriptApi()


def _fetch_with_retry(video_id: str, on_retry: RetryCallback = None) -> object:
    """Attempt transcript fetch with exponential backoff on rate-limit errors.

    Returns the raw transcript result object on success.
    Raises the last exception if all retries are exhausted.

    Args:
        video_id: YouTube video ID.
        on_retry: Optional callback invoked before each retry sleep.
    """
    api = _build_api()
    last_exception: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            return api.fetch(video_id, languages=["en", "en-US", "en-GB"])
        except (TranscriptsDisabled, NoTranscriptFound):
            # Not a rate-limit issue — re-raise immediately for fallback handling
            raise
        except Exception as e:
            last_exception = e
            error_str = str(e).lower()
            is_retryable = (
                "429" in error_str
                or "too many" in error_str
                or "max retries" in error_str
                or "connection" in error_str
                or "timeout" in error_str
                or "retryerror" in error_str
            )
            if is_retryable:
                delay = BASE_DELAY_SECONDS * (2**attempt)
                logger.warning(
                    "Retryable error fetching transcript for %s (attempt %d/%d): %s, "
                    "retrying in %ds",
                    video_id,
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    delay,
                )
                if on_retry:
                    on_retry(attempt + 1, MAX_RETRIES, type(e).__name__, delay)
                time.sleep(delay)
            else:
                # Non-retryable error — don't retry
                raise

    raise last_exception  # type: ignore[misc]


def fetch_transcript(video_id: str, on_retry: RetryCallback = None) -> str:
    """Fetch the transcript for a YouTube video and concatenate segments.

    Tries English first, then falls back to any available language.
    Uses a proxy if WEBSHARE_PROXY_USER and WEBSHARE_PROXY_PASS are set.
    Retries with exponential backoff on HTTP 429 rate-limit errors.

    Args:
        video_id: The 11-character YouTube video ID.
        on_retry: Optional callback invoked before each retry sleep.

    Returns:
        A single string with all transcript snippet texts joined by spaces.

    Raises:
        HTTPException(422): If the transcript is disabled or unavailable.
    """
    try:
        result = _fetch_with_retry(video_id, on_retry=on_retry)
    except (TranscriptsDisabled, NoTranscriptFound):
        # Fallback: try any available transcript
        api = _build_api()
        try:
            transcript_list = api.list(video_id)
            first_transcript = next(iter(transcript_list))
            result = first_transcript.fetch()
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail=f"Transcript unavailable: {type(e).__name__}: {e}",
            )
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Transcript fetch error: {type(e).__name__}: {e}",
        )

    return " ".join(snippet.text for snippet in result.snippets)
