from __future__ import annotations

from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing

UserModel = get_user_model()

EMAIL_VERIFICATION_SALT = "accounts.email.verification"
PASSWORD_RESET_SALT = "accounts.password.reset"


def _token_payload_for_user(user):
    return {"uid": user.id, "email": user.email}


def generate_email_verification_token(user) -> str:
    return signing.dumps(_token_payload_for_user(user), salt=EMAIL_VERIFICATION_SALT)


def generate_password_reset_token(user) -> str:
    return signing.dumps(_token_payload_for_user(user), salt=PASSWORD_RESET_SALT)


def _load_user_from_token(token: str, *, salt: str, max_age: int):
    payload = signing.loads(token, salt=salt, max_age=max_age)
    user_id = payload.get("uid")
    email = payload.get("email")
    if not user_id or not email:
        raise signing.BadSignature("Token payload is missing required fields.")
    return UserModel.objects.filter(id=user_id, email__iexact=email).first()


def load_user_from_email_verification_token(token: str):
    max_age = int(getattr(settings, "EMAIL_VERIFICATION_TOKEN_MAX_AGE", 24 * 60 * 60))
    return _load_user_from_token(token, salt=EMAIL_VERIFICATION_SALT, max_age=max_age)


def load_user_from_password_reset_token(token: str):
    max_age = int(getattr(settings, "PASSWORD_RESET_TOKEN_MAX_AGE", 30 * 60))
    return _load_user_from_token(token, salt=PASSWORD_RESET_SALT, max_age=max_age)


def build_frontend_link(path: str, token: str) -> str:
    frontend_base = str(getattr(settings, "FRONTEND_URL", "http://127.0.0.1:8000")).rstrip("/")
    query = urlencode({"token": token})
    return f"{frontend_base}{path}?{query}"
