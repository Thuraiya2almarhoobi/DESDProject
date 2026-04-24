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

from .models import Order

MONEY_Q = Decimal("0.01")

# Administrator commission-reporting views used by the custom admin dashboard.


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_Q)


def _parse_iso_date(raw: str | None, *, field_name: str) -> date:
    if not raw:
        raise ValueError(f"{field_name} is required (YYYY-MM-DD).")
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be YYYY-MM-DD.") from exc


def _normalize_status(raw_status: str) -> str:
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
    """Export the filtered commission report in CSV format."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            start_date = _parse_iso_date(request.query_params.get("start"), field_name="start")
            end_date = _parse_iso_date(request.query_params.get("end"), field_name="end")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        producer_id = request.query_params.get("producer_id")
        status_value = request.query_params.get("status")
        queryset = _report_queryset(start_date, end_date, producer_id, status_value)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="commission-report-{start_date.isoformat()}-{end_date.isoformat()}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(
            [
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
        )
        for order in queryset:
            for sub_order in order.sub_orders.select_related("producer").all():
                writer.writerow(
                    [
                        order.id,
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
        return response


class AdminCommissionMonthlySummaryAPIView(APIView):
    """Return a month-by-month commission summary for the selected year."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
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
