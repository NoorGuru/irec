"""Unit tests for the auth middleware."""

import os
from unittest.mock import patch

import pytest
from jose import jwt

from app.auth import verify_owner


# Test secret and owner email for JWT generation
TEST_SECRET = "test-jwt-secret-key"
TEST_OWNER_EMAIL = "owner@example.com"


def _make_token(payload: dict) -> str:
    """Helper to create a valid JWT token with the given payload."""
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def _env_vars(monkeypatch):
    """Set required environment variables for all tests."""
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("OWNER_EMAIL", TEST_OWNER_EMAIL)
    # Reload module-level variables
    import app.auth as auth_module
    auth_module.SUPABASE_JWT_SECRET = TEST_SECRET
    auth_module.OWNER_EMAIL = TEST_OWNER_EMAIL


class TestVerifyOwner:
    """Tests for verify_owner dependency."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_email(self):
        token = _make_token({"email": TEST_OWNER_EMAIL, "sub": "user-id-123"})
        result = await verify_owner(authorization=f"Bearer {token}")
        assert result == TEST_OWNER_EMAIL

    @pytest.mark.asyncio
    async def test_valid_token_case_insensitive_email(self):
        """Email comparison should be case-insensitive."""
        token = _make_token({"email": "OWNER@EXAMPLE.COM", "sub": "user-id-123"})
        result = await verify_owner(authorization=f"Bearer {token}")
        assert result == "OWNER@EXAMPLE.COM"

    @pytest.mark.asyncio
    async def test_missing_authorization_header_returns_401(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await verify_owner(authorization=None)
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Authentication required"

    @pytest.mark.asyncio
    async def test_authorization_without_bearer_prefix_returns_401(self):
        from fastapi import HTTPException

        token = _make_token({"email": TEST_OWNER_EMAIL})
        with pytest.raises(HTTPException) as exc_info:
            await verify_owner(authorization=f"Basic {token}")
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Authentication required"

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await verify_owner(authorization="Bearer invalid.jwt.token")
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Authentication required"

    @pytest.mark.asyncio
    async def test_expired_or_tampered_token_returns_401(self):
        from fastapi import HTTPException

        # Token signed with a different secret
        token = jwt.encode(
            {"email": TEST_OWNER_EMAIL}, "wrong-secret", algorithm="HS256"
        )
        with pytest.raises(HTTPException) as exc_info:
            await verify_owner(authorization=f"Bearer {token}")
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Authentication required"

    @pytest.mark.asyncio
    async def test_token_without_email_claim_returns_401(self):
        from fastapi import HTTPException

        token = _make_token({"sub": "user-id-123"})
        with pytest.raises(HTTPException) as exc_info:
            await verify_owner(authorization=f"Bearer {token}")
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Authentication required"

    @pytest.mark.asyncio
    async def test_wrong_email_returns_403(self):
        from fastapi import HTTPException

        token = _make_token({"email": "other@example.com", "sub": "user-id-456"})
        with pytest.raises(HTTPException) as exc_info:
            await verify_owner(authorization=f"Bearer {token}")
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Not authorized"

    @pytest.mark.asyncio
    async def test_empty_bearer_token_returns_401(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await verify_owner(authorization="Bearer ")
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Authentication required"
