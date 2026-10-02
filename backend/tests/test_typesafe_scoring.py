"""Unit tests for TypeSafe calibrated scoring and context slicing."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.schemas import Recommendation
from app.typesafe_service import (
    slice_transcript_context,
    score_conviction_and_sentiment,
    score_recommendations_batch,
    score_single_recommendation,
    _half_up_int,
)


def test_half_up_int_boundaries():
    assert _half_up_int(2.5) == 3
    assert _half_up_int(2.4) == 2
    assert _half_up_int(-0.5) == -1
    assert _half_up_int(0.5) == 1


def test_slice_transcript_context_exact_quote():
    transcript = (
        "Hello everyone. Today we look at the market. "
        "NVIDIA is demonstrating incredible Blackwell GPU demand and scaling compute revenue. "
        "We are also seeing Apple sales recover in China."
    )
    quote = "NVIDIA is demonstrating incredible Blackwell GPU demand"
    snippet = slice_transcript_context(transcript, quote=quote, ticker="NVDA", window_chars=100)
    assert quote.lower() in snippet.lower()
    assert len(snippet) <= 150


def test_slice_transcript_context_ticker_fallback():
    transcript = (
        "Macro intro segment. The Fed met on Wednesday. "
        "Talking about NVDA and its GPU margins now. "
        "Closing out with discussion on Treasury yields."
    )
    snippet = slice_transcript_context(transcript, quote="", ticker="NVDA", window_chars=80)
    assert "NVDA" in snippet


def test_slice_transcript_context_short():
    transcript = "Short text about TSLA."
    snippet = slice_transcript_context(transcript, ticker="TSLA", window_chars=500)
    assert snippet == transcript


def test_recommendation_schema_with_calibrated_fields():
    rec = Recommendation(
        ticker="NVDA",
        stock_name="NVIDIA Corporation",
        sentiment=2,
        conviction_level=8,
        catalyst_notes="Strong AI datacenter revenue expansion.",
        quote="Blackwell demand is through the roof.",
        conviction_score=84.5,
        conviction_confidence=0.92,
        sentiment_score=1.85,
        sentiment_confidence=0.88,
    )
    assert rec.conviction_score == 84.5
    assert rec.conviction_confidence == 0.92
    assert rec.sentiment_score == 1.85
    assert rec.sentiment_confidence == 0.88
    assert rec.quote == "Blackwell demand is through the roof."


@pytest.mark.anyio
async def test_score_recommendations_batch_fallback_when_unconfigured():
    with patch("app.typesafe_service.is_typesafe_configured", return_value=False):
        recs = [
            Recommendation(
                ticker="AMD",
                stock_name="Advanced Micro Devices",
                sentiment=1,
                conviction_level=7,
                catalyst_notes="MI300 ramp proceeding well.",
            )
        ]
        result = await score_recommendations_batch(recs, "AMD is growing rapidly.")
        assert len(result) == 1
        assert result[0].conviction_level == 7
        assert result[0].conviction_score == 70.0
        assert result[0].sentiment == 1
        assert result[0].sentiment_score == 1.0


@pytest.mark.anyio
async def test_score_conviction_and_sentiment_mocked():
    mock_score_conv = MagicMock()
    mock_score_conv.score = 3.2  # 3.2 out of 4.0 -> 80.0 out of 100.0
    mock_score_conv.confidence = 0.91

    mock_score_sent = MagicMock()
    mock_score_sent.score = 3.5  # 3.5 out of 4.0 -> +1.5 sentiment
    mock_score_sent.confidence = 0.87

    mock_response = MagicMock()
    mock_response.scores = {
        "conviction": mock_score_conv,
        "sentiment": mock_score_sent,
    }

    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        res = await score_conviction_and_sentiment(
            ticker="NVDA",
            catalyst_notes="High growth",
            transcript_snippet="NVDA is our top pick.",
            stock_name="NVIDIA",
            quote="NVDA is our top pick.",
            video_title="AI Leaders",
            channel_name="Test Channel",
        )
        assert res["conviction_score"] == 80.0
        assert res["conviction_level"] == 8
        assert res["conviction_confidence"] == 0.91
        assert res["sentiment_score"] == 1.5
        assert res["sentiment"] == 2
        assert res["sentiment_confidence"] == 0.87

        call_kwargs = mock_client.system_one.call_args.kwargs
        state = call_kwargs["state"]
        assert state["stock_name"] == "NVIDIA"
        assert state["quote"] == "NVDA is our top pick."
        assert state["video_title"] == "AI Leaders"
        assert state["channel_name"] == "Test Channel"
        # Speech-act rubric — no portfolio % bands
        conv_q = call_kwargs["questions"]["conviction"]
        criteria_text = " ".join(str(c) for c in conv_q.criteria)
        assert "portfolio" not in criteria_text.lower() or "%" not in criteria_text


@pytest.mark.anyio
@pytest.mark.parametrize(
    "jev_score,expected_100,expected_level",
    [
        (0.8, 20.0, 2),
        (1.2, 30.0, 3),
        (2.5, 62.5, 6),
        (1.0, 25.0, 3),  # half-up: 25.0 / 10 -> 3, not banker's 2
    ],
)
async def test_score_mapping_realistic_regime(jev_score, expected_100, expected_level):
    mock_score_conv = MagicMock()
    mock_score_conv.score = jev_score
    mock_score_conv.confidence = 0.80
    mock_score_sent = MagicMock()
    mock_score_sent.score = 2.0
    mock_score_sent.confidence = 0.80
    mock_response = MagicMock()
    mock_response.scores = {"conviction": mock_score_conv, "sentiment": mock_score_sent}

    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        res = await score_conviction_and_sentiment(
            ticker="AMD",
            catalyst_notes="notes",
            transcript_snippet="AMD is interesting.",
        )
        assert res["conviction_score"] == expected_100
        assert res["conviction_level"] == expected_level


@pytest.mark.anyio
async def test_missing_conviction_falls_back_to_claude_baseline():
    mock_response = MagicMock()
    mock_response.scores = {}
    mock_client = AsyncMock()
    mock_client.system_one = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.typesafe_service._get_async_client", return_value=mock_client):
        res = await score_conviction_and_sentiment(
            ticker="NVDA",
            catalyst_notes="notes",
            transcript_snippet="snippet",
            claude_conviction_level=8,
            claude_sentiment=1,
        )
        assert res["conviction_score"] == 80.0
        assert res["conviction_level"] == 8
        assert res["sentiment_score"] == 1.0


@pytest.mark.anyio
async def test_recalibrate_video_signals_with_youtube_id():
    from app.admin_routes import recalibrate_video_signals

    mock_client = MagicMock()

    def table_side_effect(table_name):
        t = MagicMock()
        if table_name == "videos":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{
                    "video_id": "11111111-2222-3333-4444-555555555555",
                    "youtube_video_id": "dQw4w9WgXcQ",
                    "transcript": "AAPL is great",
                    "title": "Top Tech",
                    "video_summary": "Summary",
                    "channels": {"channel_name": "Test Channel"},
                }]
            )
            return t
        elif table_name == "recommendations":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{
                    "ticker": "AAPL",
                    "stock_name": "Apple Inc",
                    "sentiment": 1,
                    "conviction_level": 7,
                    "target_price": 250.0,
                    "catalyst_notes": "AI phones",
                    "quote": "AAPL is great",
                    "initial_conviction_level": 8,
                    "initial_sentiment": 2,
                }]
            )
            t.delete.return_value.eq.return_value.execute.return_value = MagicMock()
            t.insert.return_value.execute.return_value = MagicMock()
            return t
        return t

    mock_client.table.side_effect = table_side_effect

    with patch("app.admin_routes._get_client", return_value=mock_client), \
         patch("app.database._get_client", return_value=mock_client), \
         patch("app.typesafe_service.is_typesafe_configured", return_value=False):
        result = await recalibrate_video_signals(video_id="dQw4w9WgXcQ")
        assert result["status"] == "success"
        assert result["recalibrated_count"] == 1
        assert result["recommendations"][0]["ticker"] == "AAPL"
        # Uses initial_* baseline (8), not already-calibrated level (7)
        assert result["recommendations"][0]["conviction_score"] == 80.0


@pytest.mark.anyio
async def test_initial_baseline_preserved_on_score():
    rec = Recommendation(
        ticker="NVDA",
        stock_name="Nvidia",
        sentiment=1,
        conviction_level=8,
        catalyst_notes="Leading GPU maker",
        quote="Nvidia leads AI",
    )
    assert rec.initial_conviction_level is None
    assert rec.initial_sentiment is None

    with patch("app.typesafe_service.score_conviction_and_sentiment") as mock_score:
        mock_score.return_value = {
            "conviction_score": 85.0,
            "conviction_confidence": 0.9,
            "conviction_level": 9,
            "sentiment_score": 1.5,
            "sentiment_confidence": 0.8,
            "sentiment": 2,
            "is_verified": True,
            "target_price_verified": False,
        }
        res = await score_single_recommendation(rec, "Nvidia leads AI", model="mock")
        assert res.initial_conviction_level == 8
        assert res.initial_sentiment == 1
        assert res.conviction_level == 9
        assert res.sentiment == 2
        # Enriched metadata forwarded
        assert mock_score.call_args.kwargs.get("quote") == "Nvidia leads AI"
        assert mock_score.call_args.kwargs.get("stock_name") == "Nvidia"


def test_slice_transcript_context_ngram_with_ellipsis():
    transcript = (
        "Welcome to the channel. Today we analyze memory storage. "
        "In its latest quarter, it kept 80 cents of every dollar. "
        "And that is exactly what happens when everybody needs your product and only three companies can make it. "
        "We are very bullish on this cycle."
    )
    quote = "In its latest quarter, it kept 80 cents... and only three companies can make it."
    snippet = slice_transcript_context(transcript, quote=quote, ticker="MU", window_chars=250)
    assert snippet != ""
    assert "three companies" in snippet.lower()


def test_slice_transcript_context_corporate_suffix_removal():
    transcript = (
        "Sponsor read for 2 minutes. "
        "Now turning to our main semiconductor discussion. "
        "Qualcomm has signed new smartphone IP licensing agreements and is expanding Snapdragon into PCs. "
        "End of video."
    )
    snippet = slice_transcript_context(
        transcript,
        ticker="QCOM",
        stock_name="Qualcomm Incorporated",
        catalyst_notes="Snapdragon PC expansion and licensing deals.",
        window_chars=150,
    )
    assert "Qualcomm" in snippet
    assert "Sponsor read" not in snippet


@pytest.mark.anyio
async def test_score_single_recommendation_ungrounded_fails_open_unverified():
    rec = Recommendation(
        ticker="XYZ",
        stock_name="Completely Absent Company",
        sentiment=1,
        conviction_level=7,
        catalyst_notes="Absent thesis",
        target_price=42.0,
    )
    transcript = "This transcript only discusses macroeconomic bonds and gold with zero stock picks."
    res = await score_single_recommendation(rec, transcript)
    # Must retain the stock, mark unverified, nullify target, keep Claude baseline scores
    assert res.is_verified is False
    assert res.target_price is None
    assert res.target_price_verified is False
    assert res.conviction_score == 70.0
    assert res.sentiment_score == 1.0
    assert res.initial_conviction_level == 7


def test_feature_flag_disables_typesafe(monkeypatch):
    from app.typesafe_service import is_typesafe_configured
    monkeypatch.setenv("ENABLE_TYPESAFE_SCORING", "false")
    monkeypatch.setenv("TYPESAFE_API_KEY", "mock_key")
    assert is_typesafe_configured() is False
