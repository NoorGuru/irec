"""Transcript Fetcher - Retrieves and concatenates YouTube video transcripts."""

from fastapi import HTTPException
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
)


def fetch_transcript(video_id: str) -> str:
    """Fetch the English transcript for a YouTube video and concatenate segments.

    Args:
        video_id: The 11-character YouTube video ID.

    Returns:
        A single string with all transcript segment texts joined by spaces.

    Raises:
        HTTPException(422): If the transcript is disabled or unavailable.
    """
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
    except (TranscriptsDisabled, NoTranscriptFound):
        raise HTTPException(
            status_code=422,
            detail="Transcript unavailable for this video",
        )

    return " ".join(segment["text"] for segment in transcript)
