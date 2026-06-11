# Feature: ytportfolio, Property 3: Recommendation Schema Validation
"""
Property-based tests for Recommendation schema validation.

Validates: Requirements 2.3, 2.4, 2.5

Tests that:
- sentiment accepts integers in [-2, 2] and rejects those outside
- conviction_level accepts integers in [1, 10] and rejects those outside
- catalyst_notes accepts strings of length 1-500 and rejects empty or >500
"""

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from pydantic import ValidationError

from app.schemas import Recommendation


# Valid defaults for fields not under test
VALID_DEFAULTS = {
    "ticker": "AAPL",
    "sentiment": 0,
    "conviction_level": 5,
    "catalyst_notes": "test",
}


# --- Sentiment tests ---


@settings(max_examples=100)
@given(sentiment=st.integers(min_value=-2, max_value=2))
def test_valid_sentiment_accepted(sentiment: int):
    """For any integer in [-2, 2], Recommendation accepts it as sentiment."""
    rec = Recommendation(**{**VALID_DEFAULTS, "sentiment": sentiment})
    assert rec.sentiment == sentiment


@settings(max_examples=100)
@given(sentiment=st.integers().filter(lambda x: x < -2 or x > 2))
def test_invalid_sentiment_rejected(sentiment: int):
    """For any integer outside [-2, 2], Recommendation rejects it."""
    with pytest.raises(ValidationError):
        Recommendation(**{**VALID_DEFAULTS, "sentiment": sentiment})


# --- Conviction level tests ---


@settings(max_examples=100)
@given(conviction=st.integers(min_value=1, max_value=10))
def test_valid_conviction_level_accepted(conviction: int):
    """For any integer in [1, 10], Recommendation accepts it as conviction_level."""
    rec = Recommendation(**{**VALID_DEFAULTS, "conviction_level": conviction})
    assert rec.conviction_level == conviction


@settings(max_examples=100)
@given(conviction=st.integers().filter(lambda x: x < 1 or x > 10))
def test_invalid_conviction_level_rejected(conviction: int):
    """For any integer outside [1, 10], Recommendation rejects it."""
    with pytest.raises(ValidationError):
        Recommendation(**{**VALID_DEFAULTS, "conviction_level": conviction})


# --- Catalyst notes tests ---


@settings(max_examples=100)
@given(notes=st.text(min_size=1, max_size=500, alphabet=st.characters(blacklist_categories=("Cs",))))
def test_valid_catalyst_notes_accepted(notes: str):
    """For any string of length 1-500, Recommendation accepts it as catalyst_notes."""
    rec = Recommendation(**{**VALID_DEFAULTS, "catalyst_notes": notes})
    assert rec.catalyst_notes == notes


@settings(max_examples=100)
@given(notes=st.text(min_size=501, max_size=1000, alphabet=st.characters(blacklist_categories=("Cs",))))
def test_too_long_catalyst_notes_rejected(notes: str):
    """For strings >500 chars, Recommendation rejects them."""
    with pytest.raises(ValidationError):
        Recommendation(**{**VALID_DEFAULTS, "catalyst_notes": notes})


def test_empty_catalyst_notes_rejected():
    """Empty strings are rejected for catalyst_notes."""
    with pytest.raises(ValidationError):
        Recommendation(**{**VALID_DEFAULTS, "catalyst_notes": ""})
