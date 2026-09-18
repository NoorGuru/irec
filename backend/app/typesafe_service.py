"""TypeSafe AI (Jev / System One) Service Module for Aura.

Provides typed, calibrated decision primitives:
- Triage: Fast boolean pre-filtering (Noul)
- Verification: Catalyst & ticker hallucination check (Choice & Noul)
- Scoring: Calibrated continuous conviction and sentiment (Score)
"""

import logging
import os
from typing import Any

from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul, Score

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
# Use Case 1: Calibrated Conviction & Sentiment Scoring
# ---------------------------------------------------------------------------
async def score_conviction_and_sentiment(
    ticker: str,
    transcript_snippet: str,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """Score the analyst's conviction and sentiment using grounded Score levels.

    Returns continuous scores:
        conviction: float 1.0 to 10.0 (calibrated)
        sentiment: float -2.0 to 2.0 (calibrated)
        confidence: float
    """
    state = {
        "ticker": ticker,
        "transcript_context": transcript_snippet,
    }

    questions = {
        "conviction": Score(
            instructions=f"Rate the analyst's conviction level on {ticker} based on the transcript excerpt.",
            criteria=[
                "Passing mention, watch-list note, or hedging example; no active capital commitment.",
                "Mild or speculative interest; small starter position or technical watchlist candidate.",
                "Standard high-probability thesis backed by business fundamentals, valuation, or clear chart setup.",
                "High-conviction idea; top-tier sector allocation, explicit price target, or overweight stance.",
                "All-in / flagship conviction; cornerstone portfolio holding, maximum allocation, multi-year core bet.",
            ],
        ),
        "sentiment": Score(
            instructions=f"Score the analyst's directional sentiment towards {ticker}.",
            criteria=[
                "Strongly bearish: capital liquidation, short position, or warning of severe downside.",
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

    # Map conviction score (0.0 - 4.0) to 1.0 - 10.0 scale
    normalized_conviction = 1.0 + (conv_score.score / 4.0) * 9.0

    # Map sentiment score (0.0 - 4.0) to -2.0 to 2.0 scale
    normalized_sentiment = (sent_score.score - 2.0)

    return {
        "conviction_level": round(normalized_conviction, 2),
        "conviction_confidence": round(conv_score.confidence, 3),
        "sentiment": round(normalized_sentiment, 2),
        "sentiment_confidence": round(sent_score.confidence, 3),
        "raw_conviction_score": conv_score.score,
        "raw_sentiment_score": sent_score.score,
    }


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
