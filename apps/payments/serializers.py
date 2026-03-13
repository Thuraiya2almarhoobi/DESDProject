from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from .models import SettlementOrderLine, WeeklySettlement


class StripeCheckoutSessionRequestSerializer(serializers.Serializer):
    order_id = serializers.IntegerField(min_value=1)


class StripeCheckoutSessionConfirmSerializer(serializers.Serializer):
    session_id = serializers.CharField(max_length=255)


class StripeCheckoutCancelSerializer(serializers.Serializer):
    order_id = serializers.IntegerField(min_value=1)


class SettlementOrderLineSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    delivery_date = serializers.DateTimeField(source="order.delivery_date", read_only=True)

    class Meta:
        model = SettlementOrderLine
        fields = [
            "id",
            "order_id",
            "order_number",
            "customer_name",
            "delivery_date",
            "gross_amount",
            "commission_amount",
            "net_amount",
        ]


class WeeklySettlementSerializer(serializers.ModelSerializer):
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
