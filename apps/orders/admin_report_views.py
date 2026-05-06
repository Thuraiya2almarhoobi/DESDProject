"""
DESD Marketplace documentation.

File role:
    Builds administrator-facing financial report APIs and CSV/reporting responses.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

import csv
from datetime import date
from decimal import Decimal

from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from bristol_marketplace.export_utils import build_simple_pdf, build_simple_xlsx

from .models import Order

MONEY_Q = Decimal("0.01")

# Administrator commission-reporting views used by the custom admin dashboard.


def _money(value: Decimal) -> Decimal:
    """
    Helper for the file role: Builds administrator-facing financial report APIs and CSV/reporting responses.

    `_money` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    return value.quantize(MONEY_Q)


def _parse_iso_date(raw: str | None, *, field_name: str) -> date:
    """
    Helper for the file role: Builds administrator-facing financial report APIs and CSV/reporting responses.

    `_parse_iso_date` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    if not raw:
        raise ValueError(f"{field_name} is required (YYYY-MM-DD).")
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be YYYY-MM-DD.") from exc


def _normalize_status(raw_status: str) -> str:
    """
    Helper for the file role: Builds administrator-facing financial report APIs and CSV/reporting responses.

    `_normalize_status` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    status_map = {
        "completed": Order.Status.DELIVERED,
        "delivered": Order.Status.DELIVERED,
        "pending": Order.Status.PENDING,
        "confirmed": Order.Status.CONFIRMED,
        "ready": Order.Status.READY,
        "cancelled": Order.Status.CANCELLED,
    }
    return status_map.get(raw_status.strip().lower(), raw_status.strip().lower())


def _report_queryset(start_date: date, end_date: date, producer_id: str | None, status_value: str | None):
    """
    Helper for the file role: Builds administrator-facing financial report APIs and CSV/reporting responses.

    `_report_queryset` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # TC-025 asks for a previous-two-weeks report with optional producer/status
    # drilldowns. The shared queryset keeps list, detail, and CSV export filters
    # consistent.
    queryset = (
        Order.objects.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
        .prefetch_related("sub_orders__producer", "payment")
        .order_by("-created_at")
    )
    if producer_id:
        queryset = queryset.filter(sub_orders__producer_id=producer_id)
    if status_value:
        queryset = queryset.filter(status=_normalize_status(status_value))
    return queryset.distinct()


def _order_breakdown(order: Order) -> dict:
    """
    Helper for the file role: Builds administrator-facing financial report APIs and CSV/reporting responses.

    `_order_breakdown` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # Multi-vendor orders are expanded into producer rows so the admin can audit
    # the 5% commission and 95% payout per supplier, not only per buyer order.
    producer_breakdown = []
    for sub_order in order.sub_orders.select_related("producer").all():
        producer_breakdown.append(
            {
                "producer_id": sub_order.producer_id,
                "producer_name": sub_order.producer.business_name,
                "producer_phone": sub_order.producer.phone,
                "producer_email": sub_order.producer.contact_email,
                "subtotal_amount": str(_money(sub_order.subtotal_amount)),
                "commission_amount": str(_money(sub_order.commission_amount)),
                "payout_amount": str(_money(sub_order.payout_amount)),
                "delivery_date": str(sub_order.delivery_date),
            }
        )

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "order_date": order.created_at.date().isoformat(),
        "status": order.status,
        "payment_status": order.payment_status,
        "total_amount": str(_money(order.total_amount)),
        "commission_amount": str(_money(order.commission_amount)),
        "producer_payout_total": str(_money(order.producer_payout_total)),
        "producer_breakdown": producer_breakdown,
    }


class AdminCommissionReportAPIView(APIView):
    """Return commission totals and per-order breakdowns for a date range."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Main financial report endpoint: returns totals, per-order rows, and
        # applied filters for the React admin dashboard charts and tables.
        try:
            start_date = _parse_iso_date(request.query_params.get("start"), field_name="start")
            end_date = _parse_iso_date(request.query_params.get("end"), field_name="end")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if end_date < start_date:
            return Response({"detail": "end must be on or after start."}, status=status.HTTP_400_BAD_REQUEST)

        producer_id = request.query_params.get("producer_id")
        status_value = request.query_params.get("status")
        queryset = _report_queryset(start_date, end_date, producer_id, status_value)

        totals = queryset.aggregate(
            total_order_value=Sum("total_amount"),
            total_commission=Sum("commission_amount"),
            total_producer_payouts=Sum("producer_payout_total"),
        )
        report_rows = [_order_breakdown(order) for order in queryset]
        return Response(
            {
                "filters": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "producer_id": producer_id,
                    "status": status_value,
                },
                "totals": {
                    "total_order_value": str(_money(totals["total_order_value"] or Decimal("0.00"))),
                    "total_commission": str(_money(totals["total_commission"] or Decimal("0.00"))),
                    "total_producer_payouts": str(
                        _money(totals["total_producer_payouts"] or Decimal("0.00"))
                    ),
                    "number_of_orders": queryset.count(),
                },
                "orders": report_rows,
            }
        )


class AdminCommissionReportDetailAPIView(APIView):
    """Return the detailed commission/payment breakdown for one order."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, order_id: int):
        # Detail endpoint mirrors the report row but includes payment reference
        # and the explicit commission formula for test-case verification.
        order = get_object_or_404(
            Order.objects.prefetch_related("sub_orders__producer", "payment"),
            id=order_id,
        )
        breakdown = _order_breakdown(order)
        payment = getattr(order, "payment", None)
        breakdown["payment"] = (
            {
                "provider": payment.provider,
                "provider_reference": payment.provider_reference,
                "amount": str(_money(payment.amount)),
                "status": payment.status,
                "currency": payment.currency,
                "created_at": payment.created_at.isoformat(),
            }
            if payment
            else None
        )
        breakdown["calculation"] = {
            "formula": "commission = total_amount * 0.05",
            "commission_rate": "0.05",
            "commission_amount": str(_money(order.total_amount * Decimal("0.05"))),
        }
        return Response(breakdown)


class AdminCommissionReportExportCSVAPIView(APIView):
    """Export the filtered commission report in CSV, PDF, or XLSX format."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # CSV output is deliberately flat: one row per producer sub-order so it
        # can be imported into spreadsheet/accounting tools without nested JSON.
        try:
            start_date = _parse_iso_date(request.query_params.get("start"), field_name="start")
            end_date = _parse_iso_date(request.query_params.get("end"), field_name="end")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        producer_id = request.query_params.get("producer_id")
        status_value = request.query_params.get("status")
        queryset = _report_queryset(start_date, end_date, producer_id, status_value)

        export_format = (request.query_params.get("format") or "csv").strip().lower()
        filename_base = f"commission-report-{start_date.isoformat()}-{end_date.isoformat()}"
        headers = [
            "order_id",
            "order_number",
            "order_date",
            "status",
            "payment_status",
            "order_total",
            "order_commission",
            "producer_name",
            "producer_subtotal",
            "producer_payout",
        ]
        rows = []
        for order in queryset:
            for sub_order in order.sub_orders.select_related("producer").all():
                rows.append(
                    [
                        str(order.id),
                        order.order_number,
                        order.created_at.date().isoformat(),
                        order.status,
                        order.payment_status,
                        f"{_money(order.total_amount):.2f}",
                        f"{_money(order.commission_amount):.2f}",
                        sub_order.producer.business_name,
                        f"{_money(sub_order.subtotal_amount):.2f}",
                        f"{_money(sub_order.payout_amount):.2f}",
                    ]
                )

        if export_format == "pdf":
            response = HttpResponse(
                build_simple_pdf(f"Commission report {start_date.isoformat()} to {end_date.isoformat()}", [headers, *rows]),
                content_type="application/pdf",
            )
            response["Content-Disposition"] = f'attachment; filename="{filename_base}.pdf"'
            return response

        if export_format in {"xlsx", "excel"}:
            response = HttpResponse(
                build_simple_xlsx(headers, rows),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            response["Content-Disposition"] = f'attachment; filename="{filename_base}.xlsx"'
            return response

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.csv"'
        writer = csv.writer(response)
        writer.writerow(headers)
        writer.writerows(rows)
        return response


class AdminCommissionMonthlySummaryAPIView(APIView):
    """Return a month-by-month commission summary for the selected year."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Monthly rows power the dashboard chart and prove that commission totals
        # can be reviewed beyond the default two-week reporting window.
        year_raw = request.query_params.get("year")
        if not year_raw:
            return Response({"detail": "year is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            year = int(year_raw)
        except (TypeError, ValueError):
            return Response({"detail": "year must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        monthly_rows = []
        for month in range(1, 13):
            queryset = Order.objects.filter(created_at__year=year, created_at__month=month)
            totals = queryset.aggregate(
                total_order_value=Sum("total_amount"),
                total_commission=Sum("commission_amount"),
                total_payout=Sum("producer_payout_total"),
            )
            monthly_rows.append(
                {
                    "month": month,
                    "number_of_orders": queryset.count(),
                    "total_order_value": str(_money(totals["total_order_value"] or Decimal("0.00"))),
                    "total_commission": str(_money(totals["total_commission"] or Decimal("0.00"))),
                    "total_producer_payouts": str(
                        _money(totals["total_payout"] or Decimal("0.00"))
                    ),
                }
            )
        return Response({"year": year, "months": monthly_rows})


class AdminCommissionYTDSummaryAPIView(APIView):
    """Return a year-to-date commission summary for the selected year."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Year-to-date summary gives admins a fast sustainability/revenue total
        # without downloading the full order-level report.
        year_raw = request.query_params.get("year")
        if not year_raw:
            return Response({"detail": "year is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            year = int(year_raw)
        except (TypeError, ValueError):
            return Response({"detail": "year must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = Order.objects.filter(created_at__year=year)
        totals = queryset.aggregate(
            total_order_value=Sum("total_amount"),
            total_commission=Sum("commission_amount"),
            total_payout=Sum("producer_payout_total"),
        )
        return Response(
            {
                "year": year,
                "number_of_orders": queryset.count(),
                "total_order_value": str(_money(totals["total_order_value"] or Decimal("0.00"))),
                "total_commission": str(_money(totals["total_commission"] or Decimal("0.00"))),
                "total_producer_payouts": str(_money(totals["total_payout"] or Decimal("0.00"))),
            }
        )
