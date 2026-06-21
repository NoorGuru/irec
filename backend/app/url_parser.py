"""YouTube URL parser for extracting Video_IDs from various YouTube URL formats."""

import re
from fastapi import HTTPException
from app.schemas import ParsedURL

# Regex patterns for supported YouTube URL formats
# Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/, youtube.com/live/
_YOUTUBE_PATTERNS = [
    # youtube.com/watch?v=VIDEO_ID (with optional extra params)
    re.compile(
        r"(?:https?://)?(?:www\.)?youtube\.com/watch\?.*?v=([A-Za-z0-9_-]{11})"
    ),
    # youtu.be/VIDEO_ID (with optional query params)
    re.compile(
        r"(?:https?://)?youtu\.be/([A-Za-z0-9_-]{11})"
    ),
    # youtube.com/shorts/VIDEO_ID
    re.compile(
        r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([A-Za-z0-9_-]{11})"
    ),
    # youtube.com/embed/VIDEO_ID
    re.compile(
        r"(?:https?://)?(?:www\.)?youtube\.com/embed/([A-Za-z0-9_-]{11})"
    ),
    # youtube.com/live/VIDEO_ID
    re.compile(
        r"(?:https?://)?(?:www\.)?youtube\.com/live/([A-Za-z0-9_-]{11})"
    ),
]


def parse_url(url: str) -> ParsedURL:
    """Parse a YouTube URL and extract the Video_ID.

    Supports youtube.com/watch?v=, youtu.be/, youtube.com/shorts/,
    youtube.com/embed/, and youtube.com/live/ formats. Strips extra query parameters.

    Args:
        url: A YouTube video URL in any supported format.

    Returns:
        ParsedURL with the extracted video_id and canonical URL.

    Raises:
        HTTPException: 400 status if the URL format is not recognized.
    """
    for pattern in _YOUTUBE_PATTERNS:
        match = pattern.search(url)
        if match:
            video_id = match.group(1)
            canonical_url = f"https://www.youtube.com/watch?v={video_id}"
            return ParsedURL(video_id=video_id, canonical_url=canonical_url)

    raise HTTPException(status_code=400, detail="URL format not recognized")
