# Feature: ytportfolio, Property 2: Ticker Normalization Idempotence
"""
Property-based tests for ticker normalization idempotence.

Validates: Requirements 2.6

Tests that:
- Applying normalize_ticker once produces the same result as applying it multiple times: f(f(x)) == f(x)
- Strings differing only in case, whitespace, or period-vs-hyphen separators normalize identically
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from app.schemas import Recommendation


# Strategy: generate ticker-like strings (1-5 chars from letters, digits, spaces, periods, hyphens)
ticker_alphabet = st.sampled_from(
    list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .-")
)
ticker_strings = st.text(alphabet=ticker_alphabet, min_size=1, max_size=5)


@settings(max_examples=100)
@given(ticker=ticker_strings)
def test_normalization_idempotence(ticker: str):
    """For any ticker-like string, normalize(normalize(x)) == normalize(x)."""
    once = Recommendation.normalize_ticker(ticker)
    twice = Recommendation.normalize_ticker(once)
    assert once == twice, f"Not idempotent: normalize({ticker!r}) = {once!r}, normalize({once!r}) = {twice!r}"


@settings(max_examples=100)
@given(base=st.text(alphabet=st.sampled_from(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")), min_size=1, max_size=5))
def test_case_equivalence(base: str):
    """Strings differing only in case normalize identically."""
    upper_result = Recommendation.normalize_ticker(base.upper())
    lower_result = Recommendation.normalize_ticker(base.lower())
    assert upper_result == lower_result, (
        f"Case mismatch: normalize({base.upper()!r}) = {upper_result!r}, "
        f"normalize({base.lower()!r}) = {lower_result!r}"
    )


@settings(max_examples=100)
@given(base=st.text(alphabet=st.sampled_from(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")), min_size=1, max_size=3))
def test_whitespace_equivalence(base: str):
    """Strings differing only in whitespace normalize identically."""
    without_space = Recommendation.normalize_ticker(base)
    with_spaces = Recommendation.normalize_ticker(f" {base} ")
    with_inner_space = Recommendation.normalize_ticker(f"{base[0]} {base[1:]}" if len(base) > 1 else base)
    assert without_space == with_spaces, (
        f"Whitespace mismatch: normalize({base!r}) = {without_space!r}, "
        f"normalize({' ' + base + ' '!r}) = {with_spaces!r}"
    )
    assert without_space == with_inner_space


@settings(max_examples=100)
@given(base=st.text(alphabet=st.sampled_from(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")), min_size=2, max_size=4))
def test_separator_equivalence(base: str):
    """Strings differing only in period vs hyphen separators normalize identically."""
    # Insert a period between first and second char
    with_period = f"{base[0]}.{base[1:]}"
    # Insert a hyphen between first and second char
    with_hyphen = f"{base[0]}-{base[1:]}"
    period_result = Recommendation.normalize_ticker(with_period)
    hyphen_result = Recommendation.normalize_ticker(with_hyphen)
    assert period_result == hyphen_result, (
        f"Separator mismatch: normalize({with_period!r}) = {period_result!r}, "
        f"normalize({with_hyphen!r}) = {hyphen_result!r}"
    )
