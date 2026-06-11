# Feature: ytportfolio, Property 4: Channel Upsert Always Returns UUID
"""
Property-based tests for channel upsert always returning a valid UUID.

Validates: Requirements 3.1

Tests that:
- For any channel name, upsert_channel always returns a valid UUID string
- The returned value is never empty or None
- Both new channels and existing channels return a UUID
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.database import upsert_channel


# Strategy: generate random non-empty channel names using printable characters
channel_names = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "S", "Z")),
    min_size=1,
    max_size=100,
)


@pytest.fixture(autouse=True)
def reset_client():
    """Reset the global client before each test."""
    import app.database as db_module

    db_module._client = None
    yield
    db_module._client = None


@settings(max_examples=100)
@given(channel_name=channel_names)
@pytest.mark.asyncio
async def test_upsert_new_channel_returns_valid_uuid(channel_name: str):
    """For any channel name (new channel), upsert always returns a valid UUID."""
    import app.database as db_module

    db_module._client = None

    expected_uuid = str(uuid.uuid4())

    with patch("app.database._get_client") as mock_get:
        client = MagicMock()
        mock_get.return_value = client
        # Simulate a new channel being inserted and returning a UUID
        client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
            data=[{"channel_id": expected_uuid, "channel_name": channel_name}]
        )

        result = await upsert_channel(channel_name)

        # Result must not be None or empty
        assert result is not None
        assert result != ""
        # Result must be a valid UUID
        parsed = uuid.UUID(result)
        assert str(parsed) == result


@settings(max_examples=100)
@given(channel_name=channel_names)
@pytest.mark.asyncio
async def test_upsert_existing_channel_returns_valid_uuid(channel_name: str):
    """For any channel name (existing channel), upsert always returns a valid UUID."""
    import app.database as db_module

    db_module._client = None

    # Simulate an existing channel being found via ON CONFLICT DO UPDATE
    existing_uuid = str(uuid.uuid4())

    with patch("app.database._get_client") as mock_get:
        client = MagicMock()
        mock_get.return_value = client
        client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
            data=[{"channel_id": existing_uuid, "channel_name": channel_name}]
        )

        result = await upsert_channel(channel_name)

        # Result must not be None or empty
        assert result is not None
        assert result != ""
        # Result must be a valid UUID
        parsed = uuid.UUID(result)
        assert str(parsed) == result


@settings(max_examples=100)
@given(channel_name=channel_names)
@pytest.mark.asyncio
async def test_upsert_never_returns_none_or_empty(channel_name: str):
    """For any channel name, the upsert result is never None or an empty string."""
    import app.database as db_module

    db_module._client = None

    generated_uuid = str(uuid.uuid4())

    with patch("app.database._get_client") as mock_get:
        client = MagicMock()
        mock_get.return_value = client
        client.table.return_value.upsert.return_value.execute.return_value = MagicMock(
            data=[{"channel_id": generated_uuid, "channel_name": channel_name}]
        )

        result = await upsert_channel(channel_name)

        # Never None
        assert result is not None, f"upsert_channel returned None for channel: {channel_name!r}"
        # Never empty string
        assert result != "", f"upsert_channel returned empty string for channel: {channel_name!r}"
        # Always a valid UUID format (parseable without exception)
        uuid.UUID(result)
