from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .tokens import InvalidToken, _decode_token


class JWTAuthentication(BaseAuthentication):
    keyword = b"bearer"

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth:
            return None
        if auth[0].lower() != self.keyword:
            return None
        if len(auth) != 2:
            raise AuthenticationFailed("Invalid Authorization header.")

        raw_token = auth[1].decode("utf-8")
        try:
            payload = _decode_token(raw_token, "access")
        except InvalidToken as exc:
            raise AuthenticationFailed(str(exc)) from exc

        user_model = get_user_model()
        user = user_model.objects.filter(pk=payload.get("uid")).first()
        if user is None or not user.is_active:
            raise AuthenticationFailed("User not found or inactive.")
        return (user, raw_token)

    def authenticate_header(self, request):
        return "Bearer"
