"""Unit tests for the YouTube URL parser."""

import pytest
from fastapi import HTTPException
from app.url_parser import parse_url


class TestParseURL:
    """Tests for parse_url function."""

    def test_standard_watch_url(self):
        result = parse_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_watch_url_without_www(self):
        result = parse_url("https://youtube.com/watch?v=dQw4w9WgXcQ")
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_short_url(self):
        result = parse_url("https://youtu.be/dQw4w9WgXcQ")
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_shorts_url(self):
        result = parse_url("https://www.youtube.com/shorts/dQw4w9WgXcQ")
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_embed_url(self):
        result = parse_url("https://www.youtube.com/embed/dQw4w9WgXcQ")
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_strips_extra_query_params_time(self):
        result = parse_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_strips_extra_query_params_list(self):
        result = parse_url(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
        )
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_short_url_with_query_params(self):
        result = parse_url("https://youtu.be/dQw4w9WgXcQ?t=30")
        assert result.video_id == "dQw4w9WgXcQ"
        assert result.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_video_id_with_hyphens_and_underscores(self):
        result = parse_url("https://www.youtube.com/watch?v=abc-_12-_XY")
        assert result.video_id == "abc-_12-_XY"
        assert result.canonical_url == "https://www.youtube.com/watch?v=abc-_12-_XY"

    def test_invalid_url_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            parse_url("https://www.google.com")
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "URL format not recognized"

    def test_empty_string_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            parse_url("")
        assert exc_info.value.status_code == 400

    def test_random_text_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            parse_url("not a url at all")
        assert exc_info.value.status_code == 400

    def test_youtube_url_without_video_id_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            parse_url("https://www.youtube.com/watch?v=short")
        assert exc_info.value.status_code == 400

    def test_http_url_also_works(self):
        result = parse_url("http://www.youtube.com/watch?v=dQw4w9WgXcQ")
        assert result.video_id == "dQw4w9WgXcQ"
