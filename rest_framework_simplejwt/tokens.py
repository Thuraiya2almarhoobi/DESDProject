from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.core import signing

TOKEN_SALT = "rest_framework_simplejwt.local"
ACCESS_TOKEN_LIFETIME = timedelta(minutes=30)
REFRESH_TOKEN_LIFETIME = timedelta(days=7)


class TokenError(Exception):
    pass


class InvalidToken(TokenError):
    pass


def _encode_token(user_id: int, token_type: str) -> str:
    return signing.dumps({"uid": int(user_id), "type": token_type}, salt=TOKEN_SALT)


def _decode_token(raw_token: str, expected_type: str) -> dict[str, Any]:
    max_age = ACCESS_TOKEN_LIFETIME if expected_type == "access" else REFRESH_TOKEN_LIFETIME
    try:
        payload = signing.loads(raw_token, salt=TOKEN_SALT, max_age=max_age.total_seconds())
    except signing.BadSignature as exc:
        raise InvalidToken("Token is invalid or expired") from exc

    if payload.get("type") != expected_type:
        raise InvalidToken("Token has invalid type")
    if "uid" not in payload:
        raise InvalidToken("Token payload is missing user id")
    return payload


class AccessToken:
    def __init__(self, raw_token: str):
        self.raw_token = raw_token
        self.payload = _decode_token(raw_token, "access")

    def __str__(self) -> str:
        return self.raw_token

    @classmethod
    def for_user_id(cls, user_id: int) -> "AccessToken":
        return cls(_encode_token(user_id=user_id, token_type="access"))


class RefreshToken:
    def __init__(self, raw_token: str):
        self.raw_token = raw_token
        self.payload = _decode_token(raw_token, "refresh")

    def __str__(self) -> str:
        return self.raw_token

    @property
    def access_token(self) -> AccessToken:
        return AccessToken.for_user_id(int(self.payload["uid"]))

    @classmethod
    def for_user(cls, user) -> "RefreshToken":
        return cls(_encode_token(user_id=user.pk, token_type="refresh"))
