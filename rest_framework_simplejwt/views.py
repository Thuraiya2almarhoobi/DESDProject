from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .tokens import InvalidToken, RefreshToken


class TokenRefreshView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        raw_refresh = request.data.get("refresh")
        if not raw_refresh:
            return Response({"refresh": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh = RefreshToken(str(raw_refresh))
        except InvalidToken:
            return Response({"detail": "Token is invalid or expired"}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({"access": str(refresh.access_token)}, status=status.HTTP_200_OK)
