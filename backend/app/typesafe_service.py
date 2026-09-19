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
    target_price: float | None = None,
    window_chars: int = 3500,
) -> str:
    """Slice a relevant, boundary-safe context window from the full transcript.

    Prioritization:
    1. Verbatim quote match
    2. Candidate target_price occurrence located near the company/ticker
    3. Stock company name or ticker appearance
    4. Fallback to beginning of transcript
    """
    if not transcript:
        return ""

    if len(transcript) <= window_chars:
        return transcript

    clean_transcript = re.sub(r"\s+", " ", transcript)
    clean_transcript_lower = clean_transcript.lower()

    # Strategy 1: Find verbatim quote (normalized)
    if quote and len(quote.strip()) >= 15:
        clean_quote = re.sub(r"\s+", " ", quote).strip().lower()
        idx = clean_transcript_lower.find(clean_quote)
        if idx != -1:
            half = window_chars // 2
            start = max(0, idx - half)
            end = min(len(clean_transcript), idx + len(clean_quote) + half)
            return clean_transcript[start:end].strip()

    # Build company name search tokens (e.g. "Microsoft Corp" -> ["Microsoft Corp", "Microsoft"])
    company_tokens = []
    if stock_name:
        s_clean = re.sub(r"\b(inc|corp|corporation|ltd|holdings|co|company)\b\.?", "", stock_name, flags=re.IGNORECASE).strip()
        if len(s_clean) >= 3:
            company_tokens.append(s_clean.lower())
        if stock_name.strip().lower() not in company_tokens:
            company_tokens.append(stock_name.strip().lower())
    if ticker:
        company_tokens.append(ticker.strip().lower())

    # Strategy 2: If target_price is provided, locate occurrences of the price number
    if target_price is not None and target_price > 0:
        tp_num = int(target_price) if target_price == int(target_price) else target_price
        # Match price number with word boundary or dollar sign
        tp_pattern = re.compile(rf"(?:\$|\b){re.escape(str(tp_num))}(?:\.0+)?\b")
        price_matches = list(tp_pattern.finditer(clean_transcript))

        if price_matches:
            # Score each price match by proximity to company_tokens
            best_idx = None
            best_dist = float("inf")
            for m in price_matches:
                m_pos = m.start()
                # Check for company token in surrounding window
                local_window = clean_transcript_lower[max(0, m_pos - 2000) : min(len(clean_transcript), m_pos + 2000)]
                for tok in company_tokens:
                    if tok in local_window:
                        tok_pos = local_window.find(tok)
                        dist = abs(tok_pos - 2000)
                        if dist < best_dist:
                            best_dist = dist
                            best_idx = m_pos

            # If an occurrence near company was found, or fall back to first occurrence
            chosen_idx = best_idx if best_idx is not None else price_matches[0].start()
            half = window_chars // 2
            start = max(0, chosen_idx - half)
            end = min(len(clean_transcript), chosen_idx + half)
            return clean_transcript[start:end].strip()

    # Strategy 3: Find stock name or ticker
    for term in company_tokens:
        pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
        match = pattern.search(clean_transcript)
        if match:
            idx = match.start()
            half = window_chars // 2
            start = max(0, idx - half)
            end = min(len(clean_transcript), idx + len(term) + half)
            return clean_transcript[start:end].strip()

    # Strategy 4: Fallback to beginning of transcript
    return clean_transcript[:window_chars].strip()


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
# Use Case 1 & 2: Unified Scoring & Extraction Verification Cascade
# ---------------------------------------------------------------------------
async def score_conviction_and_sentiment(
    ticker: str,
    catalyst_notes: str,
    transcript_snippet: str,
    target_price: float | None = None,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """Score analyst conviction (0-100) and sentiment (-2 to +2), and verify candidate pick & target price via Jev System One.

    Unified single-call evaluation:
    - Conviction: Continuous 0-100 expected value
    - Sentiment: Continuous -2 to +2 expected value
    - Gate 1 (Opinion): Is it an active recommendation rather than a passing mention? (Noul)
    - Gate 2 (Thesis): Does the context support the catalyst thesis? (Choice)
    - Gate 3 (Target Price): Is target_price the analyst's genuine target? (Choice, with conditional adversarial escalation)
    """
    state: dict[str, Any] = {
        "ticker": ticker,
        "catalyst_notes": catalyst_notes,
        "transcript_context": transcript_snippet,
    }
    if target_price is not None:
        state["candidate_target_price"] = f"${target_price}"

    questions: dict[str, Any] = {
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
        "is_real_opinion": Noul(
            instructions=(
                f"Does the speaker express an active, dedicated investment thesis or recommendation on {ticker} "
                "(such as buying, holding, shorting, or accumulating a position), "
                "rather than merely citing it in passing as a benchmark, competitor comparison, or macro example?"
            )
        ),
        "thesis_relation": Choice(
            instructions=f"Does the transcript context support the extracted catalyst thesis for {ticker}?",
            criteria={
                "supports": "The speaker explicitly presents this thesis as their stance on this stock.",
                "contradicts": "The speaker actually says the opposite or warns against this thesis.",
                "unsupported": "The thesis is unmentioned, fabricated, or refers to a different company.",
            },
        ),
    }

    if target_price is not None:
        questions["target_price_validity"] = Choice(
            instructions=f"Analyze how the candidate price target of ${target_price} relates to {ticker} in the transcript context.",
            criteria={
                "analyst_own_target": f"The speaker explicitly establishes ${target_price} as their own future price target or valuation objective for {ticker}.",
                "current_or_cost_basis": f"${target_price} is the current market price, entry price, or past cost basis.",
                "third_party_target": f"${target_price} is set by an outside party or Wall Street bank (e.g. Goldman Sachs, Morgan Stanley).",
                "support_or_stop_loss": f"${target_price} is a stop-loss, technical support, or breakdown level.",
                "not_present": f"${target_price} is not stated in the transcript context.",
            },
        )

    async with _get_async_client() as client:
        response = await client.system_one(
            model=model,
            state=state,
            questions=questions,
        )

        conv_score = getattr(response, "scores", {}).get("conviction") if hasattr(response, "scores") else None
        sent_score = getattr(response, "scores", {}).get("sentiment") if hasattr(response, "scores") else None

        # Continuous 0.0 to 100.0 scale: (Jev Score / 4.0) * 100.0
        if conv_score is not None:
            conviction_score_val = round((conv_score.score / 4.0) * 100.0, 1)
            conv_conf = conv_score.confidence
            if conv_conf <= 0.0 and hasattr(conv_score, "probabilities") and conv_score.probabilities:
                conv_conf = max(conv_score.probabilities.values())
            elif conv_conf <= 0.0:
                conv_conf = 0.20
        else:
            conviction_score_val = 50.0
            conv_conf = 0.20

        conviction_level_val = max(1, min(10, round(conviction_score_val / 10.0)))

        # Continuous -2.00 to +2.00 scale: (Jev Score - 2.0)
        if sent_score is not None:
            sentiment_score_val = round(sent_score.score - 2.0, 2)
            sent_conf = sent_score.confidence
            if sent_conf <= 0.0 and hasattr(sent_score, "probabilities") and sent_score.probabilities:
                sent_conf = max(sent_score.probabilities.values())
            elif sent_conf <= 0.0:
                sent_conf = 0.20
        else:
            sentiment_score_val = 0.0
            sent_conf = 0.20

        sentiment_val = max(-2, min(2, round(sentiment_score_val)))

        # Parse Verification Gates
        opinion_noul = 1.0
        if hasattr(response, "nouls") and "is_real_opinion" in response.nouls:
            opinion_noul = response.nouls["is_real_opinion"].noul

        thesis_choice = None
        if hasattr(response, "choices") and "thesis_relation" in response.choices:
            thesis_choice = response.choices["thesis_relation"]

        target_price_status = None
        target_price_confidence = None
        target_price_verified = False

        if target_price is not None and hasattr(response, "choices") and "target_price_validity" in response.choices:
            tp_choice = response.choices["target_price_validity"]
            target_price_status = tp_choice.choice
            target_price_confidence = tp_choice.confidence

            # Level 2 Escalation: If Call 1 target check is ambiguous (conf < 0.65), run adversarial cross-examination
            if target_price_status == "analyst_own_target" and target_price_confidence < 0.65:
                try:
                    adv_questions = {
                        "adversarial_target_falsification": Choice(
                            instructions=f"Specifically scrutinize whether the speaker disavows, hedges, or distances themselves from the ${target_price} price objective for {ticker}.",
                            criteria={
                                "speaker_disavows_or_rejects": f"The speaker explicitly distances themselves from ${target_price}, expresses skepticism, or refuses to endorse it as their target.",
                                "speaker_fully_endorses": f"The speaker firmly commits to ${target_price} as their personal price target or expected valuation for {ticker}.",
                                "neutral_or_unclear": "Neither strongly endorsed nor rejected.",
                            },
                        )
                    }
                    adv_resp = await client.system_one(model=model, state=state, questions=adv_questions)
                    if hasattr(adv_resp, "choices") and "adversarial_target_falsification" in adv_resp.choices:
                        adv_choice = adv_resp.choices["adversarial_target_falsification"]
                        if adv_choice.choice == "speaker_fully_endorses" and adv_choice.confidence >= 0.70:
                            target_price_verified = True
                        else:
                            target_price_verified = False
                            target_price_status = adv_choice.choice
                except Exception as adv_err:
                    logger.warning(f"Adversarial check error for {ticker}: {adv_err}")
                    target_price_verified = False
            elif target_price_status == "analyst_own_target" and target_price_confidence >= 0.65:
                target_price_verified = True
            else:
                target_price_verified = False

        # Gate 1 & Gate 2 Verification
        is_real = opinion_noul >= 0.30
        contradicts = bool(thesis_choice and thesis_choice.choice == "contradicts" and thesis_choice.confidence >= 0.70)
        is_verified = is_real and not contradicts

    return {
        "conviction_score": conviction_score_val,
        "conviction_confidence": round(conv_conf, 2),
        "conviction_level": conviction_level_val,
        "sentiment_score": sentiment_score_val,
        "sentiment_confidence": round(sent_conf, 2),
        "sentiment": sentiment_val,
        "is_verified": is_verified,
        "is_real_opinion_prob": round(opinion_noul, 2),
        "thesis_status": thesis_choice.choice if thesis_choice else "supports",
        "thesis_confidence": round(thesis_choice.confidence, 2) if thesis_choice else 1.0,
        "target_price_status": target_price_status,
        "target_price_confidence": round(target_price_confidence, 2) if target_price_confidence else None,
        "target_price_verified": target_price_verified,
    }


async def score_single_recommendation(
    rec: Recommendation,
    transcript: str,
    model: str = DEFAULT_MODEL,
) -> Recommendation:
    """Evaluate calibrated scores and verify recommendation & target price with fail-open fallback."""
    try:
        snippet = slice_transcript_context(
            transcript=transcript,
            quote=rec.quote,
            ticker=rec.ticker,
            stock_name=rec.stock_name,
            target_price=rec.target_price,
            window_chars=3500,
        )

        calibrated = await score_conviction_and_sentiment(
            ticker=rec.ticker,
            catalyst_notes=rec.catalyst_notes,
            transcript_snippet=snippet,
            target_price=rec.target_price,
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
        rec.is_verified = calibrated.get("is_verified", True)
        rec.target_price_verified = calibrated.get("target_price_verified", False)

        # Gate 3: Apply target price auto-nullification if unverified
        if rec.target_price is not None:
            if not rec.target_price_verified:
                logger.info(
                    f"[GUARD] Nullifying unverified target price ${rec.target_price} for {rec.ticker} "
                    f"(status={calibrated.get('target_price_status')})"
                )
                rec.target_price = None
            else:
                logger.info(
                    f"[GUARD] Target price ${rec.target_price} verified for {rec.ticker} "
                    f"(conf={calibrated.get('target_price_confidence')})"
                )

    except Exception as e:
        logger.warning(
            f"TypeSafe scoring/verification failed for {rec.ticker}: {e}. Failing open with Claude baseline."
        )
        # Fail-open: ensure baseline integer values remain intact
        if rec.conviction_score is None and rec.conviction_level:
            rec.conviction_score = float(rec.conviction_level * 10)
        if rec.sentiment_score is None and rec.sentiment is not None:
            rec.sentiment_score = float(rec.sentiment)
        rec.is_verified = True
        rec.target_price_verified = False

    return rec


async def score_recommendations_batch(
    recs: list[Recommendation],
    transcript: str,
    model: str = DEFAULT_MODEL,
) -> list[Recommendation]:
    """Score and verify a batch of recommendations in parallel using Jev System One."""
    if not recs:
        return recs

    if not is_typesafe_configured():
        logger.warning("TYPESAFE_API_KEY not configured. Skipping calibrated scoring & verification.")
        # Ensure default conviction_score is populated from conviction_level for consistency
        for rec in recs:
            if rec.conviction_score is None:
                rec.conviction_score = float(rec.conviction_level * 10)
            if rec.sentiment_score is None:
                rec.sentiment_score = float(rec.sentiment)
            rec.is_verified = True
            rec.target_price_verified = False
        return recs

    tasks = [
        score_single_recommendation(rec=rec, transcript=transcript, model=model)
        for rec in recs
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    scored_recs = []
    for idx, res in enumerate(results):
        if isinstance(res, Exception):
            logger.warning(f"Error scoring/verifying rec {recs[idx].ticker}: {res}")
            recs[idx].is_verified = True
            scored_recs.append(recs[idx])
        else:
            scored_recs.append(res)

    # Gate 1 & 2: Filter out dropped casual mentions or contradicted recommendations
    verified_recs = []
    for r in scored_recs:
        if getattr(r, "is_verified", True) is False:
            logger.info(f"[GUARD] Dropping unverified/casual mention of {r.ticker}")
        else:
            verified_recs.append(r)

    return verified_recs


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
