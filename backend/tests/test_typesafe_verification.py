"""Unit tests for TypeSafe Use Case 2: Extraction Verification & Target Price Guardrails."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.schemas import Recommendation
from app.typesafe_service import (
    score_conviction_and_sentiment,
    score_single_recommendation,
    score_recommendations_batch,
)


def _build_mock_jev_response(
    conviction_score=3.5,
    conviction_conf=0.90,
    sentiment_score=3.5,
    sentiment_conf=0.88,
    is_real_opinion=0.95,
    thesis_choice="supports",
    thesis_conf=0.85,
    tp_choice="analyst_own_target",
    tp_conf=0.88,
):
    mock_conv = MagicMock()
    mock_conv.score = conviction_score
    mock_conv.confidence = conviction_conf

    mock_sent = MagicMock()
    mock_sent.score = sentiment_score
    mock_sent.confidence = sentiment_conf

    mock_opinion = MagicMock()
    mock_opinion.noul = is_real_opinion

    mock_thesis = MagicMock()
    mock_thesis.choice = thesis_choice
    mock_thesis.confidence = thesis_conf

    scores = {"conviction": mock_conv, "sentiment": mock_sent}
    nouls = {"is_real_opinion": mock_opinion}
    choices = {"thesis_relation": mock_thesis}

    if tp_choice is not None:
        mock_tp = MagicMock()
        mock_tp.choice = tp_choice
        mock_tp.confidence = tp_conf
        choices["target_price_validity"] = mock_tp

    mock_resp = MagicMock()
    mock_resp.scores = scores
    mock_resp.nouls = nouls
    mock_resp.choices = choices
    return mock_resp


@pytest.mark.anyio
async def test_verification_genuine_recommendation_and_target_price():
    mock_resp = _build_mock_jev_response(
        conviction_score=3.6,
        sentiment_score=3.8,
        is_real_opinion=0.96,
        thesis_choice="supports",
        tp_choice="analyst_own_target",
        tp_conf=0.89,
    )
    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        rec = Recommendation(
            ticker="PLTR",
            stock_name="Palantir",
            sentiment=2,
            conviction_level=8,
            target_price=95.0,
            catalyst_notes="AIP enterprise customer acceleration.",
            quote="Our 12-month price target is 95 dollars.",
        )
        scored = await score_single_recommendation(rec, "Full transcript context about PLTR with 95 target.")
        assert scored.is_verified is True
        assert scored.target_price == 95.0
        assert scored.target_price_verified is True
        assert scored.conviction_score == 90.0
        assert scored.sentiment_score == 1.8


@pytest.mark.anyio
async def test_verification_casual_mention_dropped():
    mock_resp = _build_mock_jev_response(
        is_real_opinion=0.10,  # Below 0.30 threshold
        thesis_choice="unsupported",
    )
    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        recs = [
            Recommendation(
                ticker="INTC",
                stock_name="Intel",
                sentiment=-1,
                conviction_level=3,
                catalyst_notes="Passing negative comparison.",
            )
        ]
        result = await score_recommendations_batch(recs, "Unlike Intel which is struggling, AMD is soaring.")
        assert len(result) == 0  # Dropped from batch


@pytest.mark.anyio
async def test_verification_contradicted_thesis_dropped():
    mock_resp = _build_mock_jev_response(
        is_real_opinion=0.85,
        thesis_choice="contradicts",
        thesis_conf=0.92,
    )
    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        recs = [
            Recommendation(
                ticker="TSLA",
                stock_name="Tesla",
                sentiment=2,
                conviction_level=8,
                catalyst_notes="Strong robotaxi rollout next month.",
            )
        ]
        result = await score_recommendations_batch(recs, "Robotaxi is delayed indefinitely, I am short TSLA.")
        assert len(result) == 0  # Contradicted thesis dropped


@pytest.mark.anyio
async def test_verification_current_price_target_nullified():
    mock_resp = _build_mock_jev_response(
        is_real_opinion=0.92,
        thesis_choice="supports",
        tp_choice="current_or_cost_basis",
        tp_conf=0.95,
    )
    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        rec = Recommendation(
            ticker="PLTR",
            stock_name="Palantir",
            sentiment=2,
            conviction_level=8,
            target_price=65.0,  # Actually the current price!
            catalyst_notes="Enterprise AIP growth.",
        )
        scored = await score_single_recommendation(rec, "Palantir is trading at 65 dollars today.")
        assert scored.is_verified is True  # Recommendation kept
        assert scored.target_price is None  # Target price stripped!
        assert scored.target_price_verified is False


@pytest.mark.anyio
async def test_verification_third_party_target_nullified():
    mock_resp = _build_mock_jev_response(
        is_real_opinion=0.90,
        thesis_choice="supports",
        tp_choice="third_party_target",
        tp_conf=0.88,
    )
    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        rec = Recommendation(
            ticker="PLTR",
            stock_name="Palantir",
            sentiment=2,
            conviction_level=8,
            target_price=35.0,  # Morgan Stanley's target, not the speaker's
            catalyst_notes="Enterprise AIP growth.",
        )
        scored = await score_single_recommendation(rec, "Morgan Stanley has a target of 35 dollars which is wrong.")
        assert scored.is_verified is True
        assert scored.target_price is None  # Third-party target stripped!
        assert scored.target_price_verified is False


@pytest.mark.anyio
async def test_verification_adversarial_escalation_falsified():
    # Call 1: ambiguous own target (conf 0.55 < 0.65)
    mock_resp1 = _build_mock_jev_response(
        tp_choice="analyst_own_target",
        tp_conf=0.55,
    )
    # Call 2: adversarial check exposes speaker disavows
    mock_adv = MagicMock()
    mock_adv.choice = "speaker_disavows_or_rejects"
    mock_adv.confidence = 0.92
    mock_resp2 = MagicMock()
    mock_resp2.choices = {"adversarial_target_falsification": mock_adv}

    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(side_effect=[mock_resp1, mock_resp2])
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        rec = Recommendation(
            ticker="TSLA",
            stock_name="Tesla",
            sentiment=1,
            conviction_level=6,
            target_price=400.0,
            catalyst_notes="Viewer asked about Cathie Wood 400 target.",
        )
        scored = await score_single_recommendation(rec, "Viewer asked about 400, I am not buying.")
        assert scored.target_price is None  # Falsified by adversarial check!
        assert scored.target_price_verified is False
        assert mock_client.system_one.call_count == 2  # Escalated to Call 2


@pytest.mark.anyio
async def test_verification_adversarial_escalation_confirmed():
    # Call 1: ambiguous own target (conf 0.58 < 0.65)
    mock_resp1 = _build_mock_jev_response(
        tp_choice="analyst_own_target",
        tp_conf=0.58,
    )
    # Call 2: adversarial check confirms speaker fully endorses
    mock_adv = MagicMock()
    mock_adv.choice = "speaker_fully_endorses"
    mock_adv.confidence = 0.88
    mock_resp2 = MagicMock()
    mock_resp2.choices = {"adversarial_target_falsification": mock_adv}

    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(side_effect=[mock_resp1, mock_resp2])
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        rec = Recommendation(
            ticker="AMZN",
            stock_name="Amazon",
            sentiment=2,
            conviction_level=9,
            target_price=250.0,
            catalyst_notes="AWS cloud acceleration.",
        )
        scored = await score_single_recommendation(rec, "My personal target is 250 dollars.")
        assert scored.target_price == 250.0  # Confirmed!
        assert scored.target_price_verified is True
        assert mock_client.system_one.call_count == 2
