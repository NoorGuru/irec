"""Unit tests for TypeSafe calibrated scoring and context slicing."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.schemas import Recommendation
from app.typesafe_service import (
    slice_transcript_context,
    score_conviction_and_sentiment,
    score_recommendations_batch,
    score_single_recommendation,
)


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
        )
        assert res["conviction_score"] == 80.0
        assert res["conviction_level"] == 8
        assert res["conviction_confidence"] == 0.91
        assert res["sentiment_score"] == 1.5
        assert res["sentiment"] == 2
        assert res["sentiment_confidence"] == 0.87


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
        # Call with 11-character YouTube video ID (non-UUID)
        result = await recalibrate_video_signals(video_id="dQw4w9WgXcQ")
        assert result["status"] == "success"
        assert result["recalibrated_count"] == 1
        assert result["recommendations"][0]["ticker"] == "AAPL"
        assert result["recommendations"][0]["conviction_score"] == 70.0

