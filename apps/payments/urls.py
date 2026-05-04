"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.urls import path

from .views import (
    StripeCheckoutCancelAPIView,
    StripeCheckoutSessionConfirmAPIView,
    StripeCheckoutSessionCreateAPIView,
    StripeWebhookAPIView,
    TriggerWeeklySettlementsAPIView,
    WeeklySettlementDetailAPIView,
    WeeklySettlementExportCSVAPIView,
    WeeklySettlementListAPIView,
)


urlpatterns = [
    path("stripe/checkout-session/", StripeCheckoutSessionCreateAPIView.as_view(), name="stripe-checkout-session"),
    path("stripe/checkout-session/confirm/", StripeCheckoutSessionConfirmAPIView.as_view(), name="stripe-checkout-session-confirm"),
    path("stripe/checkout-session/cancel/", StripeCheckoutCancelAPIView.as_view(), name="stripe-checkout-session-cancel"),
    path("stripe/webhook/", StripeWebhookAPIView.as_view(), name="stripe-webhook"),
    path("settlements/", WeeklySettlementListAPIView.as_view(), name="settlement-list"),
    path("settlements/<int:pk>/", WeeklySettlementDetailAPIView.as_view(), name="settlement-detail"),
    path("settlements/<int:pk>/export/", WeeklySettlementExportCSVAPIView.as_view(), name="settlement-export-csv"),
    path("settlements/run-weekly/", TriggerWeeklySettlementsAPIView.as_view(), name="settlement-run-weekly"),
]
