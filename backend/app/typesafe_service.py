"""TypeSafe AI (Jev / System One) Service Module for Aura.

Provides typed, calibrated decision primitives:
- Triage: Fast boolean pre-filtering (Noul)
- Verification: Catalyst & ticker hallucination check (Choice & Noul)
- Scoring: Calibrated continuous conviction (0-100) and sentiment (-2 to +2) (Score)
"""

import asyncio
import logging
import os
import re
from typing import Any

from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul, Score

from .schemas import Recommendation

logger = logging.getLogger(__name__)

TYPESAFE_API_KEY = os.environ.get("TYPESAFE_API_KEY")
DEFAULT_MODEL = "jev-latest"


def is_typesafe_configured() -> bool:
    """Check if the TypeSafe API key is available in environment."""
    return bool(os.environ.get("TYPESAFE_API_KEY"))


def _get_async_client() -> AsyncTypeSafeClient:
    """Create an AsyncTypeSafeClient instance."""
    api_key = os.environ.get("TYPESAFE_API_KEY")
    if not api_key:
        raise ValueError("TYPESAFE_API_KEY is not configured in environment or .env file.")
    return AsyncTypeSafeClient(api_key=api_key)


# ---------------------------------------------------------------------------
# Context Slicing Helper
# ---------------------------------------------------------------------------
def slice_transcript_context(
    transcript: str,
    quote: str = "",
    ticker: str = "",
    stock_name: str = "",
    window_chars: int = 1500,
) -> str:
    """Slice a relevant, boundary-safe context window from the full transcript.

    Tries to locate verbatim quote first, then falls back to stock name or ticker,
    and finally falls back to transcript header.
    """
    if not transcript:
        return ""

    if len(transcript) <= window_chars:
        return transcript

    # Strategy 1: Find verbatim quote (normalized)
    if quote and len(quote.strip()) >= 15:
        clean_quote = re.sub(r"\s+", " ", quote).strip().lower()
        clean_transcript = re.sub(r"\s+", " ", transcript).lower()
        idx = clean_transcript.find(clean_quote)
        if idx != -1:
            half = window_chars // 2
            start = max(0, idx - half)
            end = min(len(transcript), idx + len(clean_quote) + half)
            return transcript[start:end].strip()

    # Strategy 2: Find stock name or ticker
    search_terms = []
    if stock_name and len(stock_name.strip()) >= 3:
        search_terms.append(stock_name.strip())
    if ticker:
        search_terms.append(ticker.strip())

    for term in search_terms:
        # Match as whole word
        pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
        match = pattern.search(transcript)
        if match:
            idx = match.start()
            half = window_chars // 2
            start = max(0, idx - half)
            end = min(len(transcript), idx + len(term) + half)
            return transcript[start:end].strip()

    # Strategy 3: Fallback to beginning of transcript
    return transcript[:window_chars].strip()


# ---------------------------------------------------------------------------
# Use Case 3: Ingestion Pre-Filter & Gatekeeper
# ---------------------------------------------------------------------------
async def triage_transcript(
    video_title: str,
    channel_name: str,
    transcript_preview: str,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """Triage whether a video contains actionable stock/ETF conviction theses.

    Returns:
        {
            "has_recommendations": bool,
            "probability": float,
            "raw_noul": float
        }
    """
    state = {
        "video_title": video_title,
        "channel_name": channel_name,
        "transcript_preview": transcript_preview[:4000],
    }

    questions = {
        "has_stock_picks": Noul(
            instructions=(
                "Does this video contain specific, actionable stock or ETF buy/sell/hold recommendations "
                "or conviction theses, rather than general macro/economic commentary or educational news?"
            )
        )
    }

    async with _get_async_client() as client:
        response = await client.system_one(
            model=model,
            state=state,
            questions=questions,
        )

    noul_val = response.nouls["has_stock_picks"].noul
    return {
        "has_recommendations": noul_val >= 0.20,
        "probability": noul_val,
        "raw_noul": noul_val,
    }


# ---------------------------------------------------------------------------
# Use Case 1: Calibrated Conviction (0-100) & Sentiment (-2 to +2)
# ---------------------------------------------------------------------------
async def score_conviction_and_sentiment(
    ticker: str,
    catalyst_notes: str,
    transcript_snippet: str,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """Score analyst conviction (0-100) and sentiment (-2 to +2) via Jev System One.

    Returns continuous expected-value scores and calibrated confidence metrics.
    """
    state = {
        "ticker": ticker,
        "catalyst_notes": catalyst_notes,
        "transcript_context": transcript_snippet,
    }

    questions = {
        "conviction": Score(
            instructions=(
                f"Rate the analyst's conviction level and portfolio capital commitment on {ticker} "
                "based on the transcript context and stated catalyst."
            ),
            criteria=[
                "Passing mention, watch-list note, illustrative example, or hedge; no personal capital committed.",
                "Speculative interest, exploratory swing trade, or small starter position (under 2% of portfolio).",
                "Standard core portfolio holding (2% to 5%) backed by business fundamentals, valuation, or chart.",
                "High conviction / overweight position (5% to 10%), top sector pick, or explicit price target.",
                "Cornerstone flagship holding (over 10% of portfolio), maximum allocation, highest conviction idea.",
            ],
        ),
        "sentiment": Score(
            instructions=f"Score the analyst's directional sentiment towards {ticker}.",
            criteria=[
                "Strongly bearish: capital liquidation, short/put position, or warning of severe downside.",
                "Mildly bearish: trimming position, downgrading target, or expressing heightened macro caution.",
                "Neutral / hold: balanced risk-reward, awaiting earnings/catalyst before taking action.",
                "Mildly bullish: accumulating small tranches, constructive chart, favorable valuation.",
                "Strongly bullish: aggressive accumulation, top buy pick, major upside target.",
            ],
        ),
    }

    async with _get_async_client() as client:
        response = await client.system_one(
            model=model,
            state=state,
            questions=questions,
        )

    conv_score = response.scores["conviction"]
    sent_score = response.scores["sentiment"]

    # Continuous 0.0 to 100.0 scale: (Jev Score / 4.0) * 100.0
    conviction_score_val = round((conv_score.score / 4.0) * 100.0, 1)

    # Legacy 1 to 10 integer scale for backward compatibility
    conviction_level_val = max(1, min(10, round(conviction_score_val / 10.0)))

    # Continuous -2.00 to +2.00 scale: (Jev Score - 2.0)
    sentiment_score_val = round(sent_score.score - 2.0, 2)

    # Legacy -2 to 2 integer scale
    sentiment_val = max(-2, min(2, round(sentiment_score_val)))

    # Signal clarity: use Jev confidence if > 0, otherwise fallback to mode probability
    conv_conf = conv_score.confidence
    if conv_conf <= 0.0 and hasattr(conv_score, "probabilities") and conv_score.probabilities:
        conv_conf = max(conv_score.probabilities.values())
    elif conv_conf <= 0.0:
        conv_conf = 0.20

    sent_conf = sent_score.confidence
    if sent_conf <= 0.0 and hasattr(sent_score, "probabilities") and sent_score.probabilities:
        sent_conf = max(sent_score.probabilities.values())
    elif sent_conf <= 0.0:
        sent_conf = 0.20

    return {
        "conviction_score": conviction_score_val,
        "conviction_confidence": round(conv_conf, 2),
        "conviction_level": conviction_level_val,
        "sentiment_score": sentiment_score_val,
        "sentiment_confidence": round(sent_conf, 2),
        "sentiment": sentiment_val,
    }


async def score_single_recommendation(
    rec: Recommendation,
    transcript: str,
    model: str = DEFAULT_MODEL,
) -> Recommendation:
    """Evaluate calibrated scores for a single recommendation with fail-open fallback."""
    try:
        snippet = slice_transcript_context(
            transcript=transcript,
            quote=rec.quote,
            ticker=rec.ticker,
            stock_name=rec.stock_name,
        )

        calibrated = await score_conviction_and_sentiment(
            ticker=rec.ticker,
            catalyst_notes=rec.catalyst_notes,
            transcript_snippet=snippet,
            model=model,
        )

        # Archive initial baseline if not already captured
        if rec.initial_conviction_level is None:
            rec.initial_conviction_level = rec.conviction_level
        if rec.initial_sentiment is None:
            rec.initial_sentiment = rec.sentiment

        # Apply calibrated values
        rec.conviction_score = calibrated["conviction_score"]
        rec.conviction_confidence = calibrated["conviction_confidence"]
        rec.conviction_level = calibrated["conviction_level"]
        rec.sentiment_score = calibrated["sentiment_score"]
        rec.sentiment_confidence = calibrated["sentiment_confidence"]
        rec.sentiment = calibrated["sentiment"]

    except Exception as e:
        logger.warning(
            f"TypeSafe scoring failed for {rec.ticker}: {e}. Failing open with Claude baseline."
        )
        # Fail-open: ensure baseline integer values remain intact
        if rec.conviction_score is None and rec.conviction_level:
            rec.conviction_score = float(rec.conviction_level * 10)
        if rec.sentiment_score is None and rec.sentiment is not None:
            rec.sentiment_score = float(rec.sentiment)

    return rec


async def score_recommendations_batch(
    recs: list[Recommendation],
    transcript: str,
    model: str = DEFAULT_MODEL,
) -> list[Recommendation]:
    """Score a batch of recommendations in parallel using Jev System One."""
    if not recs:
        return recs

    if not is_typesafe_configured():
        logger.warning("TYPESAFE_API_KEY not configured. Skipping calibrated scoring.")
        # Ensure default conviction_score is populated from conviction_level for consistency
        for rec in recs:
            if rec.conviction_score is None:
                rec.conviction_score = float(rec.conviction_level * 10)
            if rec.sentiment_score is None:
                rec.sentiment_score = float(rec.sentiment)
        return recs

    tasks = [
        score_single_recommendation(rec=rec, transcript=transcript, model=model)
        for rec in recs
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    scored_recs = []
    for idx, res in enumerate(results):
        if isinstance(res, Exception):
            logger.warning(f"Error scoring rec {recs[idx].ticker}: {res}")
            scored_recs.append(recs[idx])
        else:
            scored_recs.append(res)

    return scored_recs


# ---------------------------------------------------------------------------
# Use Case 2: Extraction Verification (Hallucination Guardrail)
# ---------------------------------------------------------------------------
async def verify_recommendation(
    ticker: str,
    catalyst_notes: str,
    transcript_snippet: str,
    target_price: float | None = None,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """Verify an extracted recommendation against supporting transcript text.

    Returns:
        {
            "is_verified": bool,
            "catalyst_status": "supports" | "contradicts" | "unsupported",
            "confidence": float,
            "is_real_recommendation_prob": float
        }
    """
    state = {
        "ticker": ticker,
        "catalyst_notes": catalyst_notes,
        "transcript_context": transcript_snippet,
        "target_price": target_price,
    }

    questions = {
        "thesis_relation": Choice(
            instructions=f"Does the transcript context support the extracted catalyst thesis for {ticker}?",
            criteria={
                "supports": "The speaker explicitly presents this thesis as their stance on this stock.",
                "contradicts": "The speaker says the opposite or warns against this thesis.",
                "unsupported": "The thesis is unmentioned, fabricated, or refers to a different company.",
            },
        ),
        "is_real_opinion": Noul(
            instructions=f"Does the speaker express an active investment or trading opinion on {ticker}?"
        ),
    }

    async with _get_async_client() as client:
        response = await client.system_one(
            model=model,
            state=state,
            questions=questions,
        )

    thesis_choice = response.choices["thesis_relation"]
    opinion_noul = response.nouls["is_real_opinion"]

    is_verified = (
        thesis_choice.choice == "supports"
        and thesis_choice.confidence >= 0.70
        and opinion_noul.noul >= 0.40
    )

    return {
        "is_verified": is_verified,
        "catalyst_status": thesis_choice.choice,
        "catalyst_confidence": round(thesis_choice.confidence, 3),
        "is_real_opinion_prob": round(opinion_noul.noul, 3),
    }
