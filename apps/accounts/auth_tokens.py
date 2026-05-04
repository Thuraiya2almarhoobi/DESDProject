"""
DESD Marketplace documentation.

File role:
    Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

Domain context:
    Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing

UserModel = get_user_model()

EMAIL_VERIFICATION_SALT = "accounts.email.verification"
PASSWORD_RESET_SALT = "accounts.password.reset"


def _token_payload_for_user(user):
    """
    Helper for the file role: Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

    `_token_payload_for_user` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    return {"uid": user.id, "email": user.email}


def generate_email_verification_token(user) -> str:
    """
    Helper for the file role: Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

    `generate_email_verification_token` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    return signing.dumps(_token_payload_for_user(user), salt=EMAIL_VERIFICATION_SALT)


def generate_password_reset_token(user) -> str:
    """
    Helper for the file role: Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

    `generate_password_reset_token` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    return signing.dumps(_token_payload_for_user(user), salt=PASSWORD_RESET_SALT)


def _load_user_from_token(token: str, *, salt: str, max_age: int):
    """
    Helper for the file role: Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

    `_load_user_from_token` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    payload = signing.loads(token, salt=salt, max_age=max_age)
    user_id = payload.get("uid")
    email = payload.get("email")
    if not user_id or not email:
        raise signing.BadSignature("Token payload is missing required fields.")
    return UserModel.objects.filter(id=user_id, email__iexact=email).first()


def load_user_from_email_verification_token(token: str):
    """
    Helper for the file role: Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

    `load_user_from_email_verification_token` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    max_age = int(getattr(settings, "EMAIL_VERIFICATION_TOKEN_MAX_AGE", 24 * 60 * 60))
    return _load_user_from_token(token, salt=EMAIL_VERIFICATION_SALT, max_age=max_age)


def load_user_from_password_reset_token(token: str):
    """
    Helper for the file role: Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

    `load_user_from_password_reset_token` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    max_age = int(getattr(settings, "PASSWORD_RESET_TOKEN_MAX_AGE", 30 * 60))
    return _load_user_from_token(token, salt=PASSWORD_RESET_SALT, max_age=max_age)


def build_frontend_link(path: str, token: str) -> str:
    """
    Helper for the file role: Creates and validates one-time authentication tokens used by email confirmation and password-reset flows.

    `build_frontend_link` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    frontend_base = str(getattr(settings, "FRONTEND_URL", "http://127.0.0.1:8000")).rstrip("/")
    query = urlencode({"token": token})
    return f"{frontend_base}{path}?{query}"
