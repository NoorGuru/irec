"""Transcript Fetcher - Retrieves and concatenates YouTube video transcripts."""

import asyncio
import json
import logging
import os
from collections.abc import Callable

from fastapi import HTTPException
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    RequestBlocked,
    TranscriptsDisabled,
)
from youtube_transcript_api.proxies import WebshareProxyConfig

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
BASE_DELAY_SECONDS = 3

# Type for an optional async retry callback: (attempt, max_retries, error, delay) -> None
AsyncRetryCallback = Callable[[int, int, str, int], None] | None


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
            retries_when_blocked=2,
        )
        return YouTubeTranscriptApi(proxy_config=proxy_config)

    return YouTubeTranscriptApi()


def _fetch_transcript_ytdlp(video_id: str) -> str | None:
    """Fallback transcript fetch using yt-dlp with mobile client (less restricted).

    Uses the 'ios' or 'android' innertube client which YouTube rate-limits less
    aggressively than web clients from datacenter IPs.
    Routes through Webshare proxy if configured, to avoid datacenter IP blocks.

    Returns the transcript text or None if unavailable.
    """
    import yt_dlp

    url = f"https://www.youtube.com/watch?v={video_id}"

    # Build proxy URL if Webshare credentials are available
    proxy_url = None
    proxy_user = os.environ.get("WEBSHARE_PROXY_USER")
    proxy_pass = os.environ.get("WEBSHARE_PROXY_PASS")
    if proxy_user and proxy_pass:
        proxy_url = f"http://{proxy_user}:{proxy_pass}@p.webshare.io:80"

    # Try multiple client strategies in order of reliability from datacenter IPs
    client_strategies = [
        {"player_client": "ios,web"},
        {"player_client": "android,web"},
        {"player_client": "web"},
    ]

    for strategy in client_strategies:
        # Try with proxy first (if available), then without
        proxy_options = [proxy_url, None] if proxy_url else [None]

        for proxy in proxy_options:
            ydl_opts = {
                "skip_download": True,
                "writeautomaticsub": True,
                "writesubtitles": True,
                "subtitleslangs": ["en", "en-US", "en-GB"],
                "subtitlesformat": "json3",
                "quiet": True,
                "no_warnings": True,
                "ignore_no_formats_error": True,
                "extractor_args": {"youtube": strategy},
                "http_headers": {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                "socket_timeout": 15,
            }
            if proxy:
                ydl_opts["proxy"] = proxy

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)

                    # Try manual subs first, then auto-generated
                    subs = info.get("subtitles", {}) or {}
                    auto_subs = info.get("automatic_captions", {}) or {}

                    # Find English subtitle track
                    sub_data = None
                    for lang in ["en", "en-US", "en-GB"]:
                        if lang in subs:
                            sub_data = subs[lang]
                            break
                        if lang in auto_subs:
                            sub_data = auto_subs[lang]
                            break

                    if not sub_data:
                        # Try any English variant
                        for key in list(subs.keys()) + list(auto_subs.keys()):
                            if key.startswith("en"):
                                sub_data = subs.get(key) or auto_subs.get(key)
                                break

                    if not sub_data:
                        logger.info(
                            "yt-dlp: no English subs with strategy=%s proxy=%s for %s",
                            strategy, bool(proxy), video_id,
                        )
                        continue

                    # Find json3 format, or fall back to first available
                    sub_url = None
                    for fmt in sub_data:
                        if fmt.get("ext") == "json3":
                            sub_url = fmt.get("url")
                            break
                    if not sub_url:
                        for fmt in sub_data:
                            if fmt.get("ext") in ("vtt", "srv1", "srv2", "srv3"):
                                sub_url = fmt.get("url")
                                break

                    if not sub_url:
                        logger.info("yt-dlp: no downloadable subtitle format for %s", video_id)
                        continue

                    # Download the subtitle content
                    import httpx

                    resp = httpx.get(sub_url, timeout=30.0)
                    resp.raise_for_status()

                    content_type = resp.headers.get("content-type", "")
                    text = resp.text

                    # Parse json3 format
                    if "json" in content_type or text.strip().startswith("{"):
                        data = json.loads(text)
                        events = data.get("events", [])
                        segments = []
                        for event in events:
                            segs = event.get("segs", [])
                            for seg in segs:
                                t = seg.get("utf8", "").strip()
                                if t and t != "\n":
                                    segments.append(t)
                        if segments:
                            return " ".join(segments)
                    else:
                        # VTT or other text format
                        import re

                        lines = []
                        for line in text.split("\n"):
                            line = line.strip()
                            if not line or "-->" in line or line.startswith("WEBVTT") or line.isdigit():
                                continue
                            clean = re.sub(r"<[^>]+>", "", line)
                            if clean:
                                lines.append(clean)
                        if lines:
                            return " ".join(lines)

            except Exception as e:
                logger.warning(
                    "yt-dlp strategy=%s proxy=%s failed for %s: %s: %s",
                    strategy, bool(proxy), video_id, type(e).__name__, e,
                )
                continue

    return None


async def _fetch_with_retry(video_id: str, on_retry: AsyncRetryCallback = None) -> object:
    """Attempt transcript fetch with exponential backoff on rate-limit errors.

    Rebuilds the API client on each retry to rotate proxy IPs, avoiding
    repeated hits to the same rate-limited IP.

    Returns the raw transcript result object on success.
    Raises the last exception if all retries are exhausted.

    Args:
        video_id: YouTube video ID.
        on_retry: Optional callback invoked before each retry sleep.
    """
    last_exception: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            # Build a fresh client each attempt to rotate proxy IP
            api = _build_api()
            # Run the synchronous API call in a thread to avoid blocking the event loop
            result = await asyncio.to_thread(
                api.fetch, video_id, languages=["en", "en-US", "en-GB"]
            )
            return result
        except (TranscriptsDisabled, NoTranscriptFound):
            # Not a rate-limit issue — re-raise immediately for fallback handling
            raise
        except RequestBlocked as e:
            # Proxy IP was blocked — retry with a fresh IP
            last_exception = e
            delay = BASE_DELAY_SECONDS * (2**attempt)
            logger.warning(
                "Proxy blocked for %s (attempt %d/%d), "
                "retrying in %ds with fresh proxy",
                video_id,
                attempt + 1,
                MAX_RETRIES,
                delay,
            )
            if on_retry:
                on_retry(attempt + 1, MAX_RETRIES, "Proxy blocked, rotating IP", delay)
            await asyncio.sleep(delay)
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
                    "retrying in %ds with fresh proxy",
                    video_id,
                    attempt + 1,
                    MAX_RETRIES,
                    type(e).__name__,
                    delay,
                )
                if on_retry:
                    on_retry(attempt + 1, MAX_RETRIES, type(e).__name__, delay)
                await asyncio.sleep(delay)
            else:
                # Non-retryable error — don't retry
                raise

    raise last_exception  # type: ignore[misc]


async def fetch_transcript(video_id: str, on_retry: AsyncRetryCallback = None) -> str:
    """Fetch the transcript for a YouTube video and concatenate segments.

    Strategy (yt-dlp first since proxy is unreliable on free tier):
    1. Try yt-dlp (browser impersonation, no proxy needed — most reliable)
    2. Fall back to youtube-transcript-api with proxy + retries
    3. Fall back to youtube-transcript-api any-language

    Args:
        video_id: The 11-character YouTube video ID.
        on_retry: Optional callback invoked before each retry sleep.

    Returns:
        A single string with all transcript snippet texts joined by spaces.

    Raises:
        HTTPException(422): If the transcript is disabled or unavailable.
    """
    # Primary method: yt-dlp (multiple client strategies)
    ytdlp_result = await asyncio.to_thread(_fetch_transcript_ytdlp, video_id)
    if ytdlp_result:
        return ytdlp_result

    logger.warning("yt-dlp failed for %s, trying proxy method", video_id)

    # Fallback: youtube-transcript-api with proxy
    if on_retry:
        on_retry(0, 0, "Primary method failed, trying proxy", 0)

    try:
        result = await _fetch_with_retry(video_id, on_retry=on_retry)
        return " ".join(snippet.text for snippet in result.snippets)
    except (TranscriptsDisabled, NoTranscriptFound):
        # Try any available language
        api = _build_api()
        try:
            transcript_list = await asyncio.to_thread(api.list, video_id)
            first_transcript = next(iter(transcript_list))
            result = await asyncio.to_thread(first_transcript.fetch)
            return " ".join(snippet.text for snippet in result.snippets)
        except Exception:
            pass
    except Exception as e:
        logger.warning(
            "Proxy transcript fetch also failed for %s: %s",
            video_id,
            e,
        )

    raise HTTPException(
        status_code=422,
        detail="Transcript unavailable — all methods exhausted",
    )
