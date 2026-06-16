"""LLM Parser module for extracting stock recommendations from transcripts."""

import asyncio
import os

import anthropic
import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from .schemas import LLMResponse, Recommendation, VideoMetadata

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """You are a financial analyst assistant. Your task is to extract stock recommendations \
from YouTube video transcripts. For each stock mentioned with a clear recommendation, \
extract the ticker symbol, sentiment, target price (if mentioned), conviction level, \
and catalyst notes.

Sentiment scale: -2 (strong sell), -1 (sell/bearish), 0 (neutral/hold), \
1 (buy/bullish), 2 (strong buy)

Conviction level: 1 (passing mention) to 10 (highest conviction, portfolio cornerstone)

Only include stocks where the speaker expresses a clear directional opinion.
Do not include stocks merely mentioned in passing without a recommendation.

Respond with a JSON object matching this schema:
{
  "recommendations": [
    {
      "ticker": "SYMBOL",
      "sentiment": <int -2 to 2>,
      "target_price": <float or null>,
      "conviction_level": <int 1 to 10>,
      "catalyst_notes": "<1-500 chars summary>"
    }
  ]
}
If no recommendations are found, return: {"recommendations": []}"""


import re


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
        timeout=httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=10.0),
    )


async def _call_anthropic(client: anthropic.AsyncAnthropic, transcript: str, metadata: VideoMetadata) -> str:
    """Send transcript and metadata to Anthropic and return the raw response text."""
    user_message = (
        f"Channel: {metadata.channel_name}\n"
        f"Published: {metadata.published_at}\n\n"
        f"Transcript:\n{transcript}"
    )

    message = await client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    # Extract text from response content blocks
    return message.content[0].text


async def parse_recommendations(transcript: str, metadata: VideoMetadata) -> list[Recommendation]:
    """Parse stock recommendations from a transcript using Claude.

    Args:
        transcript: The concatenated video transcript text.
        metadata: Video metadata containing channel name and publish date.

    Returns:
        A list of Recommendation objects extracted from the transcript.

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
    try:
        cleaned = _extract_json(response_text)
        parsed = LLMResponse.model_validate_json(cleaned)
    except ValidationError:
        # Retry once on validation failure
        try:
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
                    await asyncio.sleep(delay)
                except anthropic.APITimeoutError:
                    raise HTTPException(
                        status_code=503,
                        detail="Service temporarily unavailable",
                    )

            cleaned = _extract_json(response_text)
            parsed = LLMResponse.model_validate_json(cleaned)
        except ValidationError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Could not parse recommendations: {e.errors()[0]['msg'] if e.errors() else str(e)}",
            )

    return parsed.recommendations
