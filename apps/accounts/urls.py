"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.urls import path
from rest_framework.response import Response
from rest_framework.views import APIView

try:
    from rest_framework_simplejwt.views import TokenRefreshView
except ModuleNotFoundError:  # Offline fallback when simplejwt is unavailable.
    class TokenRefreshView(APIView):
        """Fallback token-refresh endpoint used when SimpleJWT is unavailable."""

        def post(self, request):
            return Response(
                {"detail": "Token refresh unavailable: djangorestframework-simplejwt is not installed."},
                status=503,
            )

from .views import (
    AddressDetailView,
    AddressListCreateView,
    AdminOnlyView,
    CommunityOnlyView,
    CommunityRegistrationView,
    CustomerOnlyView,
    CustomerRegistrationView,
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ImageUploadView,
    ProducerOnlyView,
    ProducerRegistrationView,
    RestaurantOnlyView,
    RestaurantRegistrationView,
    VerifyEmailView,
)

# Accounts API surface:
# - role-specific registration
# - login/token refresh
# - email verification and password reset
# - current user/profile/address endpoints
# - role-gated probe endpoints used by RBAC checks
urlpatterns = [
    path("auth/register/customer/", CustomerRegistrationView.as_view(), name="register-customer"),
    path("auth/register/producer/", ProducerRegistrationView.as_view(), name="register-producer"),
    path("auth/register/community/", CommunityRegistrationView.as_view(), name="register-community"),
    path("auth/register/restaurant/", RestaurantRegistrationView.as_view(), name="register-restaurant"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="auth-password-reset-request"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="accounts-me"),
    path("uploads/images/", ImageUploadView.as_view(), name="accounts-image-upload"),
    path("addresses/", AddressListCreateView.as_view(), name="accounts-addresses"),
    path("addresses/<int:pk>/", AddressDetailView.as_view(), name="accounts-address-detail"),
    path("customer/only/", CustomerOnlyView.as_view(), name="customer-only"),
    path("producer/only/", ProducerOnlyView.as_view(), name="producer-only"),
    path("community/only/", CommunityOnlyView.as_view(), name="community-only"),
    path("restaurant/only/", RestaurantOnlyView.as_view(), name="restaurant-only"),
    path("admin/only/", AdminOnlyView.as_view(), name="admin-only"),
]
