"""
JWT token verification for mobile authentication.

This module provides JWT token verification that matches the TypeScript implementation
from the frontend. It verifies tokens signed with web_api_auth_secret from config and extracts user data.
"""

import logging
from typing import Optional

import jwt
from pydantic import BaseModel

logger = logging.getLogger("droiduse-backend.auth")


class AuthUser(BaseModel):
    """Decoded user data from JWT token."""

    id: str
    email: str
    name: Optional[str] = None
    image: Optional[str] = None
    role: str = "user"


class MobileJwtPayload(BaseModel):
    """JWT payload structure for mobile tokens."""

    userId: str
    email: str
    role: Optional[str] = None
    exp: Optional[int] = None  # Expiration timestamp
    iat: Optional[int] = None  # Issued at timestamp


def verify_mobile_token(token: str, secret: Optional[str] = None) -> Optional[AuthUser]:
    """
    Verifies a JWT token and returns the decoded user data.

    This function mirrors the TypeScript implementation from the frontend.
    It verifies tokens signed with web_api_auth_secret from config and validates required fields.

    Args:
        token: The JWT token to verify
        secret: The secret key used to sign the token (required - should be config.websocket_server.web_api_auth_secret)

    Returns:
        Decoded AuthUser data or None if verification fails

    Example:
        >>> user = verify_mobile_token("eyJhbGc...", secret=config.websocket_server.web_api_auth_secret)
        >>> if user:
        ...     print(f"User {user.email} authenticated")
    """
    auth_secret = secret

    if not auth_secret:
        logger.error("[jwt-verify] web_api_auth_secret is not configured")
        return None

    try:
        # Decode and verify the token
        decoded = jwt.decode(
            token,
            auth_secret,
            algorithms=["HS256"],  # NextAuth.js uses HS256 by default
        )

        # Validate the payload structure
        try:
            payload = MobileJwtPayload(**decoded)
        except Exception as e:
            logger.error(f"[jwt-verify] Invalid token payload structure: {e}")
            return None

        # Validate required fields
        if not payload.userId or not payload.email:
            logger.error("[jwt-verify] Invalid token payload: missing required fields")
            return None

        # Return AuthUser object
        return AuthUser(
            id=payload.userId,
            email=payload.email,
            name=None,  # Name not included in mobile token
            image=None,  # Image not included in mobile token
            role=payload.role or "user",
        )

    except jwt.ExpiredSignatureError:
        logger.error("[jwt-verify] Token expired")
        return None

    except jwt.InvalidTokenError as e:
        logger.error(f"[jwt-verify] Invalid token: {e}")
        return None

    except Exception as e:
        logger.error(f"[jwt-verify] Token verification failed: {e}")
        return None
