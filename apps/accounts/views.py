from __future__ import annotations

import logging
import re
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
try:
    from rest_framework_simplejwt.tokens import RefreshToken
except ModuleNotFoundError:  # Offline fallback when simplejwt is unavailable.
    RefreshToken = None

from apps.orders.models import CustomerProfile as OrdersCustomerProfile
from apps.orders.models import Producer as OrdersProducer

from .auth_tokens import (
    load_user_from_email_verification_token,
    load_user_from_password_reset_token,
)
from .email_utils import send_email_verification_message, send_password_reset_message
from .models import Address, CustomerProfile, LoginAttempt, ProducerProfile
from .permissions import IsAdmin, IsCommunity, IsCustomer, IsProducer, IsRestaurant
from .serializers import (
    AddressSerializer,
    CommunityRegistrationSerializer,
    CustomerRegistrationSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PROFILE_MODEL_BY_ROLE,
    PROFILE_SERIALIZER_BY_ROLE,
    ProducerRegistrationSerializer,
    RestaurantRegistrationSerializer,
    UserSummarySerializer,
    VerifyEmailSerializer,
    _validate_password_complexity,
)

logger = logging.getLogger("apps.accounts.auth")
UserModel = get_user_model()
ALLOWED_IMAGE_UPLOAD_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
IMAGE_UPLOAD_SCOPES = {"general", "products", "recipes", "stories"}


class RegisterAnonThrottle(AnonRateThrottle):
    scope = "register_anon"


class RegisterUserThrottle(UserRateThrottle):
    scope = "register_user"


class LoginAnonThrottle(AnonRateThrottle):
    scope = "login_anon"


class LoginUserThrottle(UserRateThrottle):
    scope = "login_user"


def _get_client_ip(request) -> str:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def _get_user_agent(request) -> str:
    return (request.META.get("HTTP_USER_AGENT", "") or "")[:512]


def _resolve_failed_login_context(email: str, password: str):
    normalized_email = UserModel.objects.normalize_email(email or "")
    if not normalized_email:
        return None, "invalid_credentials"

    user = UserModel.objects.filter(email__iexact=normalized_email).first()
    if user is None:
        return None, "invalid_credentials"
    if not user.is_active:
        return user, "inactive_user"
    if not user.check_password(password or ""):
        return user, "invalid_password"
    return user, "invalid_credentials"


def _record_login_attempt(request, *, email: str, user, success: bool, reason: str = ""):
    LoginAttempt.objects.create(
        email=UserModel.objects.normalize_email(email or ""),
        user=user,
        ip_address=_get_client_ip(request),
        user_agent=_get_user_agent(request),
        success=success,
        reason=reason,
    )


def _build_auth_payload(user, *, remember_me: bool = False):
    if RefreshToken is None:
        return {
            "access": "",
            "refresh": "",
            "user": UserSummarySerializer(user).data,
            "token_warning": "JWT tokens unavailable: djangorestframework-simplejwt is not installed.",
        }

    refresh = RefreshToken.for_user(user)
    if remember_me:
        refresh_lifetime = getattr(settings, "JWT_REMEMBER_ME_REFRESH_LIFETIME", timedelta(days=30))
    else:
        refresh_lifetime = getattr(settings, "JWT_DEFAULT_REFRESH_LIFETIME", timedelta(days=1))
    refresh.set_exp(lifetime=refresh_lifetime)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSummarySerializer(user).data,
    }


def _get_user_profile(user):
    return _get_or_create_editable_profile(user, ensure_exists=False)


def _infer_city_from_address(address_line: str) -> str:
    parts = [part.strip() for part in (address_line or "").split(",") if part.strip()]
    if len(parts) >= 2:
        return parts[-1]
    return "Bristol"


def _infer_display_name_from_email(email: str) -> str:
    local_part = (email or "user").split("@")[0]
    chunks = [chunk for chunk in re.split(r"[._-]+", local_part) if chunk]
    if not chunks:
        return "User"
    return " ".join(chunk.capitalize() for chunk in chunks)


def _preferred_address_for_user(user):
    return user.addresses.filter(is_default=True).first() or user.addresses.order_by("id").first()


def _bootstrap_customer_profile(user):
    profile = CustomerProfile.objects.filter(user=user).first()
    if profile is not None:
        return profile

    legacy_profile = OrdersCustomerProfile.objects.filter(user=user).first()
    default_address = _preferred_address_for_user(user)
    if default_address is None and legacy_profile and (legacy_profile.delivery_address or legacy_profile.postcode):
        default_address = Address.objects.create(
            user=user,
            label="Delivery Address",
            line1=legacy_profile.delivery_address or "Delivery Address",
            city=_infer_city_from_address(legacy_profile.delivery_address or ""),
            postcode=legacy_profile.postcode or "",
            is_default=True,
        )

    return CustomerProfile.objects.create(
        user=user,
        full_name=(legacy_profile.full_name if legacy_profile and legacy_profile.full_name else _infer_display_name_from_email(user.email)),
        phone=legacy_profile.phone if legacy_profile else "",
        allergies_text="",
        preferences_text="",
        default_address=default_address,
    )


def _bootstrap_producer_profile(user):
    profile = ProducerProfile.objects.filter(user=user).first()
    if profile is not None:
        return profile

    legacy_producer = OrdersProducer.objects.filter(user=user).first()
    address = _preferred_address_for_user(user)
    if address is None and legacy_producer and legacy_producer.postcode:
        address = Address.objects.create(
            user=user,
            label="Business Address",
            line1=legacy_producer.business_name or _infer_display_name_from_email(user.email),
            city="Bristol",
            postcode=legacy_producer.postcode,
            is_default=True,
        )

    return ProducerProfile.objects.create(
        user=user,
        business_name=(
            legacy_producer.business_name
            if legacy_producer and legacy_producer.business_name
            else _infer_display_name_from_email(user.email)
        ),
        contact_name="",
        phone=legacy_producer.phone if legacy_producer else "",
        farm_origin_text="",
        lead_time_hours=legacy_producer.lead_time_hours if legacy_producer else 48,
        address=address,
    )


def _get_or_create_editable_profile(user, *, ensure_exists: bool):
    profile_model = PROFILE_MODEL_BY_ROLE.get(user.role)
    if profile_model is None:
        return None

    profile = profile_model.objects.filter(user=user).first()
    if profile is not None or not ensure_exists:
        return profile

    if user.role == UserModel.Role.CUSTOMER:
        return _bootstrap_customer_profile(user)
    if user.role == UserModel.Role.PRODUCER:
        return _bootstrap_producer_profile(user)
    return None


def _build_me_payload(request):
    user = request.user
    profile_instance = _get_or_create_editable_profile(user, ensure_exists=True)
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
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (RegisterAnonThrottle, RegisterUserThrottle)
    serializer_class = None

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        email_delivery = send_email_verification_message(user)
        if not email_delivery.sent and not email_delivery.skipped:
            logger.warning(
                "Verification email was not sent for user_id=%s reason=%s",
                user.id,
                email_delivery.reason,
            )
        logger.info("Registration successful for email=%s role=%s", user.email, user.role)
        response_payload = _build_auth_payload(user)
        response_payload["detail"] = (
            "Registration successful, check your email to verify."
            if email_delivery.sent
            else "Registration successful."
        )
        response_payload["email_delivery"] = {
            "sent": email_delivery.sent,
            "skipped": email_delivery.skipped,
            "reason": email_delivery.reason,
        }
        return Response(response_payload, status=status.HTTP_201_CREATED)


class CustomerRegistrationView(BaseRegistrationView):
    serializer_class = CustomerRegistrationSerializer


class ProducerRegistrationView(BaseRegistrationView):
    serializer_class = ProducerRegistrationSerializer


class CommunityRegistrationView(BaseRegistrationView):
    serializer_class = CommunityRegistrationSerializer


class RestaurantRegistrationView(BaseRegistrationView):
    serializer_class = RestaurantRegistrationSerializer


class LoginView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (LoginAnonThrottle, LoginUserThrottle)

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            non_field_errors = serializer.errors.get("non_field_errors", [])
            if any(str(error) == "Invalid credentials" for error in non_field_errors):
                failed_user, reason = _resolve_failed_login_context(
                    request.data.get("email", ""),
                    request.data.get("password", ""),
                )
                _record_login_attempt(
                    request,
                    email=request.data.get("email", ""),
                    user=failed_user,
                    success=False,
                    reason=reason,
                )
                logger.warning(
                    "Login failed for email=%s ip=%s",
                    request.data.get("email"),
                    _get_client_ip(request),
                )
                return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        remember_me = serializer.validated_data.get("remember_me", False)
        _record_login_attempt(
            request,
            email=user.email,
            user=user,
            success=True,
            reason="success",
        )
        logger.info("Login successful for email=%s role=%s", user.email, user.role)
        return Response(_build_auth_payload(user, remember_me=remember_me), status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = unquote(serializer.validated_data["token"])

        try:
            user = load_user_from_email_verification_token(token)
        except (signing.BadSignature, signing.SignatureExpired):
            return Response(
                {"detail": "Invalid or expired verification token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user is None:
            return Response(
                {"detail": "Invalid or expired verification token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return Response({"detail": "Email verified successfully."}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (RegisterAnonThrottle, RegisterUserThrottle)

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        normalized_email = UserModel.objects.normalize_email(email)
        user = UserModel.objects.filter(email__iexact=normalized_email).first()
        if user is not None:
            email_delivery = send_password_reset_message(user)
            if not email_delivery.sent and not email_delivery.skipped:
                logger.warning(
                    "Password reset email was not sent for user_id=%s reason=%s",
                    user.id,
                    email_delivery.reason,
                )
        return Response(
            {"detail": "If the email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (RegisterAnonThrottle, RegisterUserThrottle)

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = unquote(serializer.validated_data["token"])
        new_password = serializer.validated_data["new_password"]

        try:
            user = load_user_from_password_reset_token(token)
        except (signing.BadSignature, signing.SignatureExpired):
            return Response(
                {"detail": "Invalid or expired reset token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user is None:
            return Response(
                {"detail": "Invalid or expired reset token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            _validate_password_complexity(new_password)
            validate_password(new_password, user=user)
        except (DjangoValidationError, DRFValidationError) as exc:
            if isinstance(exc, DjangoValidationError):
                errors = exc.messages
            else:
                details = exc.detail
                errors = details if isinstance(details, list) else [str(details)]
            return Response({"new_password": errors}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response(
            {"detail": "Password reset successful. Please log in."},
            status=status.HTTP_200_OK,
        )


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
        profile = _get_or_create_editable_profile(request.user, ensure_exists=True)
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


class ImageUploadView(APIView):
    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        upload = request.FILES.get("image")
        if upload is None:
            return Response(
                {"detail": "No image file was provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if upload.content_type not in ALLOWED_IMAGE_UPLOAD_TYPES:
            return Response(
                {"detail": "Only JPEG, PNG, WebP, and GIF images are supported."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if upload.size > MAX_IMAGE_UPLOAD_BYTES:
            return Response(
                {"detail": "Image must be 5 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        scope = str(request.data.get("scope", "general")).strip().lower()
        if scope not in IMAGE_UPLOAD_SCOPES:
            scope = "general"

        suffix = Path(upload.name or "").suffix.lower() or ALLOWED_IMAGE_UPLOAD_TYPES[upload.content_type]
        saved_path = default_storage.save(
            f"uploads/{scope}/user-{request.user.id}/{uuid4().hex}{suffix}",
            upload,
        )
        relative_url = default_storage.url(saved_path)
        return Response(
            {
                "url": request.build_absolute_uri(relative_url),
                "relative_url": relative_url,
            },
            status=status.HTTP_201_CREATED,
        )


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
