"""Transcript Fetcher - Retrieves and concatenates YouTube video transcripts."""

from fastapi import HTTPException
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
)


def fetch_transcript(video_id: str) -> str:
    """Fetch the transcript for a YouTube video and concatenate segments.

    Tries English first, then falls back to any available language.

    Args:
        video_id: The 11-character YouTube video ID.

    Returns:
        A single string with all transcript snippet texts joined by spaces.

    Raises:
        HTTPException(422): If the transcript is disabled or unavailable.
    """
    api = YouTubeTranscriptApi()

    try:
        result = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
    except (TranscriptsDisabled, NoTranscriptFound):
        # Fallback: try any available transcript
        try:
            transcript_list = api.list(video_id)
            # Pick the first available transcript
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
