from django.urls import path

from .views import (
    StripeCheckoutSessionCreateAPIView,
    StripeWebhookAPIView,
    TriggerWeeklySettlementsAPIView,
    WeeklySettlementDetailAPIView,
    WeeklySettlementExportCSVAPIView,
    WeeklySettlementListAPIView,
)


urlpatterns = [
    path("stripe/checkout-session/", StripeCheckoutSessionCreateAPIView.as_view(), name="stripe-checkout-session"),
    path("stripe/webhook/", StripeWebhookAPIView.as_view(), name="stripe-webhook"),
    path("settlements/", WeeklySettlementListAPIView.as_view(), name="settlement-list"),
    path("settlements/<int:pk>/", WeeklySettlementDetailAPIView.as_view(), name="settlement-detail"),
    path("settlements/<int:pk>/export/", WeeklySettlementExportCSVAPIView.as_view(), name="settlement-export-csv"),
    path("settlements/run-weekly/", TriggerWeeklySettlementsAPIView.as_view(), name="settlement-run-weekly"),
]
