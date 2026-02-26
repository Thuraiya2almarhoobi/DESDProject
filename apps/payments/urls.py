from django.urls import path

from .views import (
    TriggerWeeklySettlementsAPIView,
    WeeklySettlementDetailAPIView,
    WeeklySettlementExportCSVAPIView,
    WeeklySettlementListAPIView,
)


urlpatterns = [
    path("settlements/", WeeklySettlementListAPIView.as_view(), name="settlement-list"),
    path("settlements/<int:pk>/", WeeklySettlementDetailAPIView.as_view(), name="settlement-detail"),
    path("settlements/<int:pk>/export/", WeeklySettlementExportCSVAPIView.as_view(), name="settlement-export-csv"),
    path("settlements/run-weekly/", TriggerWeeklySettlementsAPIView.as_view(), name="settlement-run-weekly"),
]
