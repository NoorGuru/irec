# Feature: ytportfolio, Property 1: URL Parsing Roundtrip
"""
Property-based tests for URL parsing roundtrip.

Validates: Requirements 1.1

Tests that:
- For any valid 11-char YouTube Video_ID embedded in any supported URL format,
  parsing extracts the correct video_id.
- Re-parsing the canonical URL yields the same video_id.
- The canonical URL always has the format "https://www.youtube.com/watch?v={video_id}".
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from app.url_parser import parse_url


# Strategy: generate random 11-char video IDs from [A-Za-z0-9_-]
video_id_alphabet = st.sampled_from(
    list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")
)
video_id_strategy = st.text(alphabet=video_id_alphabet, min_size=11, max_size=11)

# Strategy: random query params to append
query_param_keys = st.sampled_from(["t", "list", "index", "si", "feature"])
query_param_values = st.text(
    alphabet=st.sampled_from(list("abcdefghijklmnopqrstuvwxyz0123456789")),
    min_size=1,
    max_size=20,
)
query_param = st.tuples(query_param_keys, query_param_values).map(
    lambda kv: f"&{kv[0]}={kv[1]}"
)
optional_query_params = st.one_of(
    st.just(""),
    query_param,
    st.tuples(query_param, query_param).map(lambda ps: ps[0] + ps[1]),
)


def build_watch_url(video_id: str, extra_params: str) -> str:
    """Build a youtube.com/watch?v= URL."""
    return f"https://www.youtube.com/watch?v={video_id}{extra_params}"


def build_short_url(video_id: str, extra_params: str) -> str:
    """Build a youtu.be/ URL."""
    # youtu.be uses ? for first param instead of &
    params = extra_params.replace("&", "?", 1) if extra_params else ""
    return f"https://youtu.be/{video_id}{params}"


def build_shorts_url(video_id: str, extra_params: str) -> str:
    """Build a youtube.com/shorts/ URL."""
    params = extra_params.replace("&", "?", 1) if extra_params else ""
    return f"https://www.youtube.com/shorts/{video_id}{params}"


def build_embed_url(video_id: str, extra_params: str) -> str:
    """Build a youtube.com/embed/ URL."""
    params = extra_params.replace("&", "?", 1) if extra_params else ""
    return f"https://www.youtube.com/embed/{video_id}{params}"


# Strategy: pick a random URL format builder
url_format_strategy = st.sampled_from(
    [build_watch_url, build_short_url, build_shorts_url, build_embed_url]
)


@settings(max_examples=100)
@given(
    video_id=video_id_strategy,
    url_builder=url_format_strategy,
    extra_params=optional_query_params,
)
def test_url_parsing_roundtrip(video_id, url_builder, extra_params):
    """
    For any valid 11-char video ID in any supported URL format:
    - Parsing extracts the correct video_id
    - Re-parsing the canonical URL yields the same video_id
    - The canonical URL always has the expected format
    """
    # Build a URL with the generated video_id
    url = url_builder(video_id, extra_params)

    # Parse the URL
    result = parse_url(url)

    # Verify the correct video_id is extracted
    assert result.video_id == video_id, (
        f"Expected video_id={video_id!r}, got {result.video_id!r} from URL {url!r}"
    )

    # Verify the canonical URL has the correct format
    expected_canonical = f"https://www.youtube.com/watch?v={video_id}"
    assert result.canonical_url == expected_canonical, (
        f"Expected canonical_url={expected_canonical!r}, got {result.canonical_url!r}"
    )

    # Re-parse the canonical URL and verify it yields the same video_id
    roundtrip_result = parse_url(result.canonical_url)
    assert roundtrip_result.video_id == video_id, (
        f"Roundtrip failed: re-parsing canonical URL gave {roundtrip_result.video_id!r}, "
        f"expected {video_id!r}"
    )
    assert roundtrip_result.canonical_url == expected_canonical, (
        f"Roundtrip canonical URL mismatch: {roundtrip_result.canonical_url!r} != {expected_canonical!r}"
    )
