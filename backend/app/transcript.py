"""Transcript Fetcher - Retrieves and concatenates YouTube video transcripts."""

import os

from fastapi import HTTPException
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
)
from youtube_transcript_api.proxies import WebshareProxyConfig


def _build_api() -> YouTubeTranscriptApi:
    """Build the transcript API client, with proxy if configured."""
    proxy_user = os.environ.get("WEBSHARE_PROXY_USER")
    proxy_pass = os.environ.get("WEBSHARE_PROXY_PASS")

    if proxy_user and proxy_pass:
        proxy_config = WebshareProxyConfig(
            proxy_username=proxy_user,
            proxy_password=proxy_pass,
        )
        return YouTubeTranscriptApi(proxy_config=proxy_config)

    return YouTubeTranscriptApi()


def fetch_transcript(video_id: str) -> str:
    """Fetch the transcript for a YouTube video and concatenate segments.

    Tries English first, then falls back to any available language.
    Uses a proxy if WEBSHARE_PROXY_USER and WEBSHARE_PROXY_PASS are set.

    Args:
        video_id: The 11-character YouTube video ID.

    Returns:
        A single string with all transcript snippet texts joined by spaces.

    Raises:
        HTTPException(422): If the transcript is disabled or unavailable.
    """
    api = _build_api()

    try:
        result = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
    except (TranscriptsDisabled, NoTranscriptFound):
        # Fallback: try any available transcript
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
