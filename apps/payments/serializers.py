"""
DESD Marketplace documentation.

File role:
    Validates API payloads and converts Django model instances into JSON-friendly response shapes.

Domain context:
    Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from .models import SettlementOrderLine, WeeklySettlement


class StripeCheckoutSessionRequestSerializer(serializers.Serializer):
    """
    Documents the `StripeCheckoutSessionRequestSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    order_id = serializers.IntegerField(min_value=1)
    success_url = serializers.CharField(required=False, allow_blank=True, max_length=2048)
    cancel_url = serializers.CharField(required=False, allow_blank=True, max_length=2048)


class StripeCheckoutSessionConfirmSerializer(serializers.Serializer):
    """
    Documents the `StripeCheckoutSessionConfirmSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    session_id = serializers.CharField(max_length=255)


class StripeCheckoutCancelSerializer(serializers.Serializer):
    """
    Documents the `StripeCheckoutCancelSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    order_id = serializers.IntegerField(min_value=1)


class SettlementOrderLineSerializer(serializers.ModelSerializer):
    """
    Documents the `SettlementOrderLineSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    order_number = serializers.SerializerMethodField()
    marketplace_order_id = serializers.SerializerMethodField()
    delivery_date = serializers.SerializerMethodField()
    source_type = serializers.SerializerMethodField()

    class Meta:
        model = SettlementOrderLine
        fields = [
            "id",
            "order_id",
            "sub_order_id",
            "source_type",
            "marketplace_order_id",
            "order_number",
            "customer_name",
            "delivery_date",
            "gross_amount",
            "commission_amount",
            "net_amount",
        ]

    def get_order_number(self, obj: SettlementOrderLine) -> str:
        if obj.order_id:
            return obj.order.order_number
        if obj.sub_order_id:
            return obj.sub_order.order.order_number
        return ""

    def get_marketplace_order_id(self, obj: SettlementOrderLine) -> int | None:
        if obj.sub_order_id:
            return obj.sub_order.order_id
        return None

    def get_delivery_date(self, obj: SettlementOrderLine):
        if obj.order_id:
            return None
        if obj.sub_order_id:
            return obj.sub_order.delivery_date
        return None

    def get_source_type(self, obj: SettlementOrderLine) -> str:
        return "legacy" if obj.order_id else "marketplace"


class WeeklySettlementSerializer(serializers.ModelSerializer):
    """
    Documents the `WeeklySettlementSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    lines = SettlementOrderLineSerializer(many=True, read_only=True)
    running_tax_year_total = serializers.SerializerMethodField()
    order_count = serializers.SerializerMethodField()

    class Meta:
        model = WeeklySettlement
        fields = [
            "id",
            "producer_id",
            "week_start",
            "week_end",
            "gross_amount",
            "commission_amount",
            "net_amount",
            "status",
            "transaction_reference",
            "order_count",
            "running_tax_year_total",
            "lines",
            "created_at",
        ]

    def get_order_count(self, obj: WeeklySettlement) -> int:
        return obj.lines.count()

    def get_running_tax_year_total(self, obj: WeeklySettlement) -> Decimal:
        start_of_year = obj.week_end.replace(month=1, day=1)
        return (
            WeeklySettlement.objects.filter(
                producer=obj.producer,
                week_end__gte=start_of_year,
                week_end__lte=obj.week_end,
            )
            .aggregate(total=Sum("net_amount"))
            .get("total")
            or Decimal("0.00")
        )
