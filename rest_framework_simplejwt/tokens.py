from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from django.conf import settings
from django.core import signing

TOKEN_SALT = "rest_framework_simplejwt.local"


class TokenError(Exception):
    pass


class InvalidToken(TokenError):
    pass


def _get_setting(name: str, default):
    return getattr(settings, name, default)


def _access_lifetime() -> timedelta:
    return _get_setting("SIMPLE_JWT", {}).get("ACCESS_TOKEN_LIFETIME", timedelta(minutes=15))


def _refresh_lifetime() -> timedelta:
    return _get_setting("SIMPLE_JWT", {}).get("REFRESH_TOKEN_LIFETIME", timedelta(days=1))


def _now_epoch() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def _to_epoch(value: datetime) -> int:
    return int(value.timestamp())


def _encode_token(user_id: int, token_type: str, lifetime: timedelta | None = None) -> str:
    now = datetime.now(tz=timezone.utc)
    if lifetime is None:
        lifetime = _access_lifetime() if token_type == "access" else _refresh_lifetime()

    payload = {
        "uid": int(user_id),
        "type": token_type,
        "iat": _to_epoch(now),
        "exp": _to_epoch(now + lifetime),
    }
    return signing.dumps(payload, salt=TOKEN_SALT)


def _decode_token(raw_token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = signing.loads(raw_token, salt=TOKEN_SALT)
    except signing.BadSignature as exc:
        raise InvalidToken("Token is invalid or expired") from exc

    if payload.get("type") != expected_type:
        raise InvalidToken("Token has invalid type")
    if "uid" not in payload:
        raise InvalidToken("Token payload is missing user id")
    if "exp" not in payload:
        raise InvalidToken("Token payload is missing expiration")
    if int(payload["exp"]) <= _now_epoch():
        raise InvalidToken("Token is invalid or expired")
    return payload


class _BaseToken:
    token_type: str = ""

    def __init__(self, raw_token: str):
        self.raw_token = raw_token
        self.payload = _decode_token(raw_token, self.token_type)

    def __getitem__(self, key: str):
        return self.payload[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.payload[key] = value

    def __str__(self) -> str:
        return self.raw_token

    def set_exp(self, lifetime: timedelta) -> None:
        now = datetime.now(tz=timezone.utc)
        self.payload["iat"] = _to_epoch(now)
        self.payload["exp"] = _to_epoch(now + lifetime)
        self.raw_token = signing.dumps(self.payload, salt=TOKEN_SALT)


class AccessToken(_BaseToken):
    token_type = "access"

    @classmethod
    def for_user_id(cls, user_id: int, *, lifetime: timedelta | None = None) -> "AccessToken":
        return cls(_encode_token(user_id=user_id, token_type="access", lifetime=lifetime))


class RefreshToken(_BaseToken):
    token_type = "refresh"

    @property
    def access_token(self) -> AccessToken:
        return AccessToken.for_user_id(int(self.payload["uid"]))

    @classmethod
    def for_user(cls, user) -> "RefreshToken":
        return cls(_encode_token(user_id=user.pk, token_type="refresh"))
