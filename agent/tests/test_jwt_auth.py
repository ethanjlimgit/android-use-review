"""
Tests for JWT authentication module.

This module tests the JWT token verification that matches the TypeScript implementation.
"""

import time

import jwt
import pytest

from droiduse_backend.auth.jwt_verify import AuthUser, verify_mobile_token


@pytest.fixture
def auth_secret():
    """Generate a test AUTH_SECRET."""
    return "test-secret-key-for-jwt-testing-12345"


@pytest.fixture
def valid_token(auth_secret):
    """Generate a valid JWT token for testing."""
    payload = {
        "userId": "user-123",
        "email": "test@example.com",
        "role": "user",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,  # Valid for 1 hour
    }
    return jwt.encode(payload, auth_secret, algorithm="HS256")


@pytest.fixture
def expired_token(auth_secret):
    """Generate an expired JWT token for testing."""
    payload = {
        "userId": "user-123",
        "email": "test@example.com",
        "role": "user",
        "iat": int(time.time()) - 7200,  # Issued 2 hours ago
        "exp": int(time.time()) - 3600,  # Expired 1 hour ago
    }
    return jwt.encode(payload, auth_secret, algorithm="HS256")


@pytest.fixture
def invalid_signature_token():
    """Generate a token signed with wrong secret."""
    payload = {
        "userId": "user-123",
        "email": "test@example.com",
        "role": "user",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, "wrong-secret", algorithm="HS256")


class TestVerifyMobileToken:
    """Test cases for verify_mobile_token function."""

    def test_verify_valid_token(self, valid_token, auth_secret):
        """Test verification of a valid token."""
        user = verify_mobile_token(valid_token, secret=auth_secret)

        assert user is not None
        assert isinstance(user, AuthUser)
        assert user.id == "user-123"
        assert user.email == "test@example.com"
        assert user.role == "user"
        assert user.name is None
        assert user.image is None

    def test_verify_expired_token(self, expired_token, auth_secret):
        """Test that expired tokens are rejected."""
        user = verify_mobile_token(expired_token, secret=auth_secret)
        assert user is None

    def test_verify_invalid_signature(self, invalid_signature_token, auth_secret):
        """Test that tokens with invalid signatures are rejected."""
        user = verify_mobile_token(invalid_signature_token, secret=auth_secret)
        assert user is None

    def test_verify_missing_secret(self, valid_token):
        """Test that verification fails when secret is not provided."""
        user = verify_mobile_token(valid_token)
        assert user is None

    def test_verify_with_explicit_secret(self, valid_token, auth_secret):
        """Test verification using explicitly provided secret."""
        user = verify_mobile_token(valid_token, secret=auth_secret)
        assert user is not None
        assert user.id == "user-123"

    def test_verify_missing_userid(self, auth_secret):
        """Test that tokens without userId are rejected."""
        payload = {
            "email": "test@example.com",
            "role": "user",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, auth_secret, algorithm="HS256")

        user = verify_mobile_token(token, secret=auth_secret)
        assert user is None

    def test_verify_missing_email(self, auth_secret):
        """Test that tokens without email are rejected."""
        payload = {
            "userId": "user-123",
            "role": "user",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, auth_secret, algorithm="HS256")

        user = verify_mobile_token(token, secret=auth_secret)
        assert user is None

    def test_verify_with_admin_role(self, auth_secret):
        """Test token verification with admin role."""
        payload = {
            "userId": "admin-456",
            "email": "admin@example.com",
            "role": "admin",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, auth_secret, algorithm="HS256")

        user = verify_mobile_token(token, secret=auth_secret)
        assert user is not None
        assert user.id == "admin-456"
        assert user.email == "admin@example.com"
        assert user.role == "admin"

    def test_verify_without_role(self, auth_secret):
        """Test that tokens without role default to 'user'."""
        payload = {
            "userId": "user-789",
            "email": "noRole@example.com",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        token = jwt.encode(payload, auth_secret, algorithm="HS256")

        user = verify_mobile_token(token, secret=auth_secret)
        assert user is not None
        assert user.role == "user"

    def test_verify_malformed_token(self, auth_secret):
        """Test that malformed tokens are rejected."""
        malformed_token = "not.a.valid.jwt.token"
        user = verify_mobile_token(malformed_token, secret=auth_secret)
        assert user is None

    def test_verify_empty_token(self, auth_secret):
        """Test that empty tokens are rejected."""
        user = verify_mobile_token("", secret=auth_secret)
        assert user is None
