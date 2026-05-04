"""
DESD Marketplace documentation.

File role:
    Routes administrator financial-report URLs separately from buyer/producer order APIs.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

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
