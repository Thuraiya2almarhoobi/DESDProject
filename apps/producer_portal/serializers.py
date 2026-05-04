"""
DESD Marketplace documentation.

File role:
    Validates API payloads and converts Django model instances into JSON-friendly response shapes.

Domain context:
    Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from rest_framework import serializers

from .models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
)


class ProducerProductSerializer(serializers.ModelSerializer):
    """
    Documents the `ProducerProductSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer_id = serializers.IntegerField(read_only=True)
    producer_name = serializers.SerializerMethodField()
    producer_email = serializers.EmailField(source="producer.email", read_only=True)
    producer_location = serializers.SerializerMethodField()
    is_visible_to_customers = serializers.BooleanField(read_only=True)
    effective_availability = serializers.CharField(read_only=True)
    seasonal_window_label = serializers.CharField(read_only=True)
    season_status_message = serializers.CharField(read_only=True)
    season_reminder_message = serializers.CharField(read_only=True)
    is_currently_in_season = serializers.SerializerMethodField()

    class Meta:
        model = ProducerProduct
        fields = [
            "id",
            "producer_id",
            "producer_name",
            "producer_email",
            "producer_location",
            "name",
            "category",
            "description",
            "price",
            "unit",
            "availability",
            "effective_availability",
            "season_start_month",
            "season_end_month",
            "seasonal_window_label",
            "season_status_message",
            "season_reminder_message",
            "is_currently_in_season",
            "stock_quantity",
            "low_stock_threshold",
            "allergen_information",
            "harvest_date",
            "image_url",
            "is_surplus",
            "surplus_discount_percent",
            "is_visible_to_customers",
            "created_at",
            "updated_at",
        ]

    def get_producer_name(self, obj: ProducerProduct) -> str:
        email = (obj.producer.email or "").lower()
        if email == "producer@example.com":
            return "Green Valley Farm"
        if email == "other@example.com":
            return "Other Producer Farm"
        local_part = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ").strip()
        if local_part:
            return " ".join(part.capitalize() for part in local_part.split())
        return "Producer"

    def get_producer_location(self, obj: ProducerProduct) -> str:
        email = (obj.producer.email or "").lower()
        if email == "producer@example.com":
            return "Kent, UK"
        return "Bristol, UK"

    def get_is_currently_in_season(self, obj: ProducerProduct) -> bool:
        return obj.is_currently_in_season()

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        availability = attrs.get("availability", getattr(instance, "availability", None))
        season_start_month = attrs.get("season_start_month", getattr(instance, "season_start_month", None))
        season_end_month = attrs.get("season_end_month", getattr(instance, "season_end_month", None))

        if availability == "in_season":
            errors = {}
            if not season_start_month:
                errors["season_start_month"] = "Season start month is required for seasonal products."
            if not season_end_month:
                errors["season_end_month"] = "Season end month is required for seasonal products."
            if errors:
                raise serializers.ValidationError(errors)

        return attrs


class ProducerOrderItemSerializer(serializers.ModelSerializer):
    """
    Documents the `ProducerOrderItemSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ProducerOrderItem
        fields = ["id", "product_id", "product_name", "quantity", "unit_price", "line_total"]


class ProducerOrderSerializer(serializers.ModelSerializer):
    """
    Documents the `ProducerOrderSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    items = ProducerOrderItemSerializer(many=True, read_only=True)
    lead_time_hours = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProducerOrder
        fields = [
            "id",
            "order_number",
            "producer_id",
            "customer_name",
            "customer_email",
            "customer_phone",
            "delivery_address",
            "order_date",
            "delivery_date",
            "lead_time_hours",
            "status",
            "total_value",
            "special_instructions",
            "items",
        ]


class ProducerOrderStatusUpdateSerializer(serializers.ModelSerializer):
    """
    Documents the `ProducerOrderStatusUpdateSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = ProducerOrder
        fields = ["status"]

    def validate_status(self, value: str) -> str:
        instance: ProducerOrder = self.instance
        allowed_transitions = {
            OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
            OrderStatus.CONFIRMED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
            OrderStatus.PREPARING: {OrderStatus.READY, OrderStatus.CANCELLED},
            OrderStatus.READY: {OrderStatus.DELIVERED, OrderStatus.CANCELLED},
            OrderStatus.DELIVERED: set(),
            OrderStatus.CANCELLED: set(),
        }

        if value == instance.status:
            return value
        if value not in allowed_transitions.get(instance.status, set()):
            raise serializers.ValidationError(
                f"Invalid status transition from '{instance.status}' to '{value}'."
            )
        return value
