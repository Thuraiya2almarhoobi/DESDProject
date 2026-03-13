from django.urls import path

from .admin_report_views import (
    AdminCommissionMonthlySummaryAPIView,
    AdminCommissionReportAPIView,
    AdminCommissionReportDetailAPIView,
    AdminCommissionReportExportCSVAPIView,
    AdminCommissionYTDSummaryAPIView,
)


urlpatterns = [
    path("commission-report/", AdminCommissionReportAPIView.as_view(), name="admin-commission-report"),
    path(
        "commission-report/export.csv",
        AdminCommissionReportExportCSVAPIView.as_view(),
        name="admin-commission-report-export",
    ),
    path(
        "commission-report/summary/monthly",
        AdminCommissionMonthlySummaryAPIView.as_view(),
        name="admin-commission-report-monthly-summary",
    ),
    path(
        "commission-report/summary/ytd",
        AdminCommissionYTDSummaryAPIView.as_view(),
        name="admin-commission-report-ytd-summary",
    ),
    path(
        "commission-report/<int:order_id>/",
        AdminCommissionReportDetailAPIView.as_view(),
        name="admin-commission-report-detail",
    ),
]
