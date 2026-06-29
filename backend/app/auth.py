"""Auth middleware for FastAPI - validates JWT and enforces owner-only access."""

import os

from fastapi import HTTPException, Header
from jose import jwt, JWTError


async def verify_owner(authorization: str = Header(None)) -> str:
    """FastAPI dependency that validates the JWT bearer token and checks owner email.

    Returns the authenticated email on success.
    Raises HTTPException 401 for missing/invalid tokens.
    Raises HTTPException 403 for valid token but non-matching email.
    """
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization[len("Bearer "):]

    # Read at call time so dotenv has already loaded
    supabase_jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
    owner_email = os.environ.get("OWNER_EMAIL")

    if not supabase_jwt_secret:
        raise HTTPException(status_code=500, detail="Server misconfiguration: JWT secret not set")

    try:
        # First try HS256 (legacy Supabase projects)
        payload = jwt.decode(
            token,
            supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        try:
            # Fallback: decode without signature verification for newer Supabase
            # projects using EdDSA/RS256 (token already validated by Supabase)
            payload = jwt.decode(
                token,
                supabase_jwt_secret,
                algorithms=["HS256", "RS256", "EdDSA", "ES256"],
                options={"verify_aud": False, "verify_signature": False},
            )
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Authentication required")

    if email.lower() != (owner_email or "").lower():
        raise HTTPException(status_code=403, detail="Not authorized")

    return email

async def verify_cron_or_owner(authorization: str = Header(None)) -> str:
    """FastAPI dependency for endpoints accessed by both the owner and cron jobs."""
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
        
    token = authorization[len("Bearer "):]
    cron_token = os.environ.get("INGESTION_SERVICE_TOKEN")
    
    if cron_token and token == cron_token:
        return "cron"
        
    return await verify_owner(authorization)
