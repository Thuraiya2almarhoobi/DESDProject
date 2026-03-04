from django.urls import path
from rest_framework.response import Response
from rest_framework.views import APIView

try:
    from rest_framework_simplejwt.views import TokenRefreshView
except ModuleNotFoundError:  # Offline fallback when simplejwt is unavailable.
    class TokenRefreshView(APIView):
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
    ProducerOnlyView,
    ProducerRegistrationView,
    RestaurantOnlyView,
    RestaurantRegistrationView,
    VerifyEmailView,
)

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
    path("addresses/", AddressListCreateView.as_view(), name="accounts-addresses"),
    path("addresses/<int:pk>/", AddressDetailView.as_view(), name="accounts-address-detail"),
    path("customer/only/", CustomerOnlyView.as_view(), name="customer-only"),
    path("producer/only/", ProducerOnlyView.as_view(), name="producer-only"),
    path("community/only/", CommunityOnlyView.as_view(), name="community-only"),
    path("restaurant/only/", RestaurantOnlyView.as_view(), name="restaurant-only"),
    path("admin/only/", AdminOnlyView.as_view(), name="admin-only"),
]
