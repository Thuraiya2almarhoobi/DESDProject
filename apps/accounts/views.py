from __future__ import annotations

import logging

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
try:
    from rest_framework_simplejwt.tokens import RefreshToken
except ModuleNotFoundError:  # Offline fallback when simplejwt is unavailable.
    RefreshToken = None

from .permissions import IsAdmin, IsCommunity, IsCustomer, IsProducer, IsRestaurant
from .serializers import (
    AddressSerializer,
    CommunityRegistrationSerializer,
    CustomerRegistrationSerializer,
    LoginSerializer,
    PROFILE_MODEL_BY_ROLE,
    PROFILE_SERIALIZER_BY_ROLE,
    ProducerRegistrationSerializer,
    RestaurantRegistrationSerializer,
    UserSummarySerializer,
)
from .models import Address

logger = logging.getLogger("apps.accounts.auth")


class RegisterAnonThrottle(AnonRateThrottle):
    scope = "register_anon"


class RegisterUserThrottle(UserRateThrottle):
    scope = "register_user"


class LoginAnonThrottle(AnonRateThrottle):
    scope = "login_anon"


class LoginUserThrottle(UserRateThrottle):
    scope = "login_user"


def _build_auth_payload(user):
    if RefreshToken is None:
        return {
            "access": "",
            "refresh": "",
            "user": UserSummarySerializer(user).data,
            "token_warning": "JWT tokens unavailable: djangorestframework-simplejwt is not installed.",
        }

    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSummarySerializer(user).data,
    }


def _get_user_profile(user):
    profile_model = PROFILE_MODEL_BY_ROLE.get(user.role)
    if profile_model is None:
        return None
    return profile_model.objects.filter(user=user).first()


def _build_me_payload(request):
    user = request.user
    profile_instance = _get_user_profile(user)
    profile_serializer = PROFILE_SERIALIZER_BY_ROLE.get(user.role)
    profile_data = None
    if profile_serializer and profile_instance is not None:
        profile_data = profile_serializer(profile_instance, context={"request": request}).data

    addresses_data = AddressSerializer(user.addresses.all(), many=True, context={"request": request}).data
    return {
        "user": UserSummarySerializer(user).data,
        "profile": profile_data,
        "addresses": addresses_data,
    }


class BaseRegistrationView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (RegisterAnonThrottle, RegisterUserThrottle)
    serializer_class = None

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info("Registration successful for email=%s role=%s", user.email, user.role)
        return Response(_build_auth_payload(user), status=status.HTTP_201_CREATED)


class CustomerRegistrationView(BaseRegistrationView):
    serializer_class = CustomerRegistrationSerializer


class ProducerRegistrationView(BaseRegistrationView):
    serializer_class = ProducerRegistrationSerializer


class CommunityRegistrationView(BaseRegistrationView):
    serializer_class = CommunityRegistrationSerializer


class RestaurantRegistrationView(BaseRegistrationView):
    serializer_class = RestaurantRegistrationSerializer


class LoginView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (LoginAnonThrottle, LoginUserThrottle)

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            non_field_errors = serializer.errors.get("non_field_errors", [])
            if any(str(error) == "Invalid credentials" for error in non_field_errors):
                logger.warning(
                    "Login failed for email=%s ip=%s",
                    request.data.get("email"),
                    request.META.get("REMOTE_ADDR"),
                )
                return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        logger.info("Login successful for email=%s role=%s", user.email, user.role)
        return Response(_build_auth_payload(user), status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(_build_me_payload(request), status=status.HTTP_200_OK)

    def patch(self, request):
        if "role" in request.data or "user" in request.data:
            return Response(
                {"detail": "Changing user role is not allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer_class = PROFILE_SERIALIZER_BY_ROLE.get(request.user.role)
        profile = _get_user_profile(request.user)
        if serializer_class is None or profile is None:
            return Response(
                {"detail": "No editable profile exists for this role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile_payload = request.data.get("profile", request.data)
        serializer = serializer_class(
            profile,
            data=profile_payload,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(_build_me_payload(request), status=status.HTTP_200_OK)


class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user).order_by("id")


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user).order_by("id")


class CustomerOnlyView(APIView):
    permission_classes = (IsAuthenticated, IsCustomer)

    def get(self, request):
        return Response({"detail": "Customer-only access granted."}, status=status.HTTP_200_OK)


class ProducerOnlyView(APIView):
    permission_classes = (IsAuthenticated, IsProducer)

    def get(self, request):
        return Response({"detail": "Producer-only access granted."}, status=status.HTTP_200_OK)


class CommunityOnlyView(APIView):
    permission_classes = (IsAuthenticated, IsCommunity)

    def get(self, request):
        return Response({"detail": "Community-only access granted."}, status=status.HTTP_200_OK)


class RestaurantOnlyView(APIView):
    permission_classes = (IsAuthenticated, IsRestaurant)

    def get(self, request):
        return Response({"detail": "Restaurant-only access granted."}, status=status.HTTP_200_OK)


class AdminOnlyView(APIView):
    permission_classes = (IsAuthenticated, IsAdmin)

    def get(self, request):
        return Response({"detail": "Admin-only access granted."}, status=status.HTTP_200_OK)
