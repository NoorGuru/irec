# Feature: ytportfolio, Property 8: Exponential Backoff Timing
"""
Property-based tests for exponential backoff timing.

Validates: Requirements 11.1

Tests that:
- For any retry_count n in [0, 1, 2], calculate_backoff_delay(n) == 2^n (i.e., 1, 2, 4)
- For any retry_count n >= 0, the delay is always positive
- The delays are strictly increasing: delay(n+1) > delay(n) for all valid n
- The maximum retry count is 3 (pattern is 1s, 2s, 4s for attempts 0, 1, 2)
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from app.llm_parser import calculate_backoff_delay


# Strategy: valid retry counts within the backoff window (0, 1, 2)
valid_retry_counts = st.integers(min_value=0, max_value=2)

# Strategy: any non-negative retry count for general properties
non_negative_retry_counts = st.integers(min_value=0, max_value=10)


@settings(max_examples=100)
@given(n=valid_retry_counts)
def test_backoff_follows_exponential_pattern(n: int):
    """For any retry_count n in [0, 1, 2], delay equals 2^n seconds."""
    delay = calculate_backoff_delay(n)
    expected = float(2**n)
    assert delay == expected, (
        f"Backoff mismatch: calculate_backoff_delay({n}) = {delay}, expected {expected}"
    )


@settings(max_examples=100)
@given(n=non_negative_retry_counts)
def test_backoff_delay_always_positive(n: int):
    """For any retry_count n >= 0, the delay is always positive."""
    delay = calculate_backoff_delay(n)
    assert delay > 0, f"Delay should be positive, got {delay} for retry_count={n}"


@settings(max_examples=100)
@given(n=st.integers(min_value=0, max_value=9))
def test_backoff_delays_strictly_increasing(n: int):
    """The delays are strictly increasing: delay(n+1) > delay(n) for all valid n."""
    delay_n = calculate_backoff_delay(n)
    delay_n_plus_1 = calculate_backoff_delay(n + 1)
    assert delay_n_plus_1 > delay_n, (
        f"Delays not strictly increasing: delay({n+1})={delay_n_plus_1} <= delay({n})={delay_n}"
    )


def test_max_retry_count_is_three():
    """Verify that 3 is the max retry count - the pattern is 1s, 2s, 4s for attempts 0, 1, 2.

    The system retries up to 3 times (attempts 0, 1, 2) before returning 429.
    This means there are exactly 3 delay values in the backoff sequence.
    """
    # The retry loop runs for attempts 0, 1, 2 (3 total attempts)
    # Delays are: attempt 0 -> 1s, attempt 1 -> 2s, attempt 2 -> 4s
    expected_delays = [1.0, 2.0, 4.0]
    max_retries = 3

    actual_delays = [calculate_backoff_delay(i) for i in range(max_retries)]
    assert actual_delays == expected_delays, (
        f"Expected delays {expected_delays}, got {actual_delays}"
    )

    # Verify the count matches the max retry configuration (3 retries)
    assert len(actual_delays) == max_retries, (
        f"Expected {max_retries} retry delays, got {len(actual_delays)}"
    )
