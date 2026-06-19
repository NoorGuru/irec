"""LLM Parser module for extracting stock recommendations from transcripts."""

import asyncio
import os
from collections.abc import Callable

import anthropic
import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from .schemas import LLMResponse, Recommendation, VideoMetadata

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")


class LLMParseError(Exception):
    """Raised when LLM response cannot be parsed into valid JSON.

    Carries the raw response text for persistence/debugging.
    """

    def __init__(self, detail: str, raw_response: str):
        self.detail = detail
        self.raw_response = raw_response
        super().__init__(detail)

MODEL = "claude-sonnet-4-6"

# Type for an optional async retry callback: (attempt, max_retries, reason, delay) -> None
AsyncRetryCallback = Callable[[int, int, str, float], None] | None

SYSTEM_PROMPT = """You are a financial analyst assistant. Your task is to extract stock recommendations \
from YouTube video transcripts. For each stock mentioned with a clear recommendation, \
extract the ticker symbol, sentiment, target price (if mentioned), conviction level, \
and catalyst notes.

CRITICAL TICKER RULES:
- Use ONLY official NYSE/NASDAQ/AMEX ticker symbols that are actively traded on US exchanges.
- If a company is NOT publicly traded (e.g., Stripe, OpenAI), do NOT include it.
- Double-check ticker accuracy: SPCE = Virgin Galactic (NOT SpaceX), META = Meta Platforms, \
GOOG/GOOGL = Alphabet, MSFT = Microsoft, TSLA = Tesla, AMZN = Amazon.
- If you are unsure about a ticker symbol, omit that recommendation entirely.
- Do NOT invent or guess ticker symbols.

Sentiment scale: -2 (strong sell), -1 (sell/bearish), 0 (neutral/hold), \
1 (buy/bullish), 2 (strong buy)

Conviction level: 1 (passing mention) to 10 (highest conviction, portfolio cornerstone)

Only include stocks where the speaker expresses a clear directional opinion.
Do not include stocks merely mentioned in passing without a recommendation.

STOCK NAME RULES:
- You MUST always provide the full company name in the "stock_name" field.
- Never leave stock_name empty or null. Example: ticker "NVDA" → stock_name "NVIDIA".

VIDEO SUMMARY RULES:
- Provide a concise "video_summary" (max 500 chars) capturing the analyst's overall thesis, \
key macro catalysts or sector themes, and whether the outlook is short-term or long-term.
- Focus on WHAT is driving the picks, not listing the picks themselves.
- If the video has no clear thesis, summarize the general market outlook discussed.

Respond with a JSON object matching this schema:
{
  "video_summary": "<max 500 chars — overall thesis, catalysts, timeframe>",
  "recommendations": [
    {
      "ticker": "SYMBOL",
      "stock_name": "Company Name (REQUIRED - never leave empty)",
      "sentiment": <int -2 to 2>,
      "target_price": <float or null>,
      "conviction_level": <int 1 to 10>,
      "catalyst_notes": "<1-500 chars summary>"
    }
  ]
}
If no recommendations are found, return: {"video_summary": "<summary>", "recommendations": []}"""


import re

from .ticker_names import lookup_stock_name


def _extract_json(text: str) -> str:
    """Extract JSON from LLM response, handling markdown code fences."""
    # Try to extract from ```json ... ``` blocks
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    # Try to find raw JSON object
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    return text


def calculate_backoff_delay(retry_count: int) -> float:
    """Calculate exponential backoff delay.

    Returns 2^retry_count seconds (1, 2, 4 for retry_count 0, 1, 2).
    """
    return float(2**retry_count)


def _build_client() -> anthropic.AsyncAnthropic:
    """Build an Anthropic async client with configured timeouts."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=502, detail="Anthropic API key not configured")
    return anthropic.AsyncAnthropic(
        api_key=api_key,
        timeout=httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0),
    )


async def _call_anthropic(client: anthropic.AsyncAnthropic, transcript: str, metadata: VideoMetadata) -> str:
    """Send transcript and metadata to Anthropic and return the raw response text.

    Uses max_tokens=16384 to avoid truncation on long videos with many recommendations.
    Raises HTTPException(502) if the response was truncated (stop_reason == 'max_tokens').
    """
    user_message = (
        f"Channel: {metadata.channel_name}\n"
        f"Published: {metadata.published_at}\n\n"
        f"Transcript:\n{transcript}"
    )

    message = await client.messages.create(
        model=MODEL,
        max_tokens=16384,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    # Extract text from response content blocks
    response_text = message.content[0].text

    # Detect truncation: if the model hit the token limit, the JSON is incomplete
    if message.stop_reason == "max_tokens":
        raise HTTPException(
            status_code=502,
            detail="AI response was truncated (too many recommendations). Please try a shorter video.",
        )

    return response_text


async def parse_recommendations(
    transcript: str, metadata: VideoMetadata, on_retry: AsyncRetryCallback = None
) -> tuple[list[Recommendation], str]:
    """Parse stock recommendations and video summary from a transcript using Claude.

    Args:
        transcript: The concatenated video transcript text.
        metadata: Video metadata containing channel name and publish date.
        on_retry: Optional callback invoked before each retry sleep.

    Returns:
        A tuple of (list of Recommendation objects, video_summary string).

    Raises:
        HTTPException(429): If Anthropic rate limits after 3 retries with backoff.
        HTTPException(502): If LLM response fails schema validation after 1 retry.
        HTTPException(503): If Anthropic API times out.
    """
    client = _build_client()

    # Rate limit retry loop with exponential backoff
    for attempt in range(3):
        try:
            response_text = await _call_anthropic(client, transcript, metadata)
            break
        except anthropic.RateLimitError:
            if attempt == 2:
                raise HTTPException(
                    status_code=429,
                    detail="AI service busy, try again later",
                )
            delay = calculate_backoff_delay(attempt)
            if on_retry:
                on_retry(attempt + 1, 3, "Rate limited", delay)
            await asyncio.sleep(delay)
        except anthropic.APITimeoutError:
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable",
            )
    else:
        # Should not reach here, but safety net
        raise HTTPException(
            status_code=429,
            detail="AI service busy, try again later",
        )

    # Schema validation with single retry
    last_raw_response = response_text
    try:
        cleaned = _extract_json(response_text)
        parsed = LLMResponse.model_validate_json(cleaned)
    except (ValidationError, ValueError) as first_error:
        # Retry once on validation failure
        if on_retry:
            on_retry(1, 2, "Invalid response format, retrying", 0)
        try:
            for attempt in range(3):
                try:
                    response_text = await _call_anthropic(client, transcript, metadata)
                    last_raw_response = response_text
                    break
                except anthropic.RateLimitError:
                    if attempt == 2:
                        raise HTTPException(
                            status_code=429,
                            detail="AI service busy, try again later",
                        )
                    delay = calculate_backoff_delay(attempt)
                    if on_retry:
                        on_retry(attempt + 1, 3, "Rate limited", delay)
                    await asyncio.sleep(delay)
                except anthropic.APITimeoutError:
                    raise HTTPException(
                        status_code=503,
                        detail="Service temporarily unavailable",
                    )

            cleaned = _extract_json(response_text)
            parsed = LLMResponse.model_validate_json(cleaned)
        except (ValidationError, ValueError) as e:
            error_msg = e.errors()[0]['msg'] if isinstance(e, ValidationError) and e.errors() else str(e)
            raise LLMParseError(
                detail=f"Invalid JSON: {error_msg}",
                raw_response=last_raw_response,
            )

    # Post-process: ensure stock_name is populated
    for rec in parsed.recommendations:
        if not rec.stock_name:
            rec.stock_name = lookup_stock_name(rec.ticker)

    return parsed.recommendations, parsed.video_summary
