"""Auth middleware for FastAPI - validates JWT and enforces owner-only access."""

import os

from fastapi import HTTPException, Header
from jose import jwt, JWTError

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL")


async def verify_owner(authorization: str = Header(None)) -> str:
    """FastAPI dependency that validates the JWT bearer token and checks owner email.

    Returns the authenticated email on success.
    Raises HTTPException 401 for missing/invalid tokens.
    Raises HTTPException 403 for valid token but non-matching email.
    """
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization[len("Bearer "):]

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Authentication required")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Authentication required")

    if email.lower() != (OWNER_EMAIL or "").lower():
        raise HTTPException(status_code=403, detail="Not authorized")

    return email
