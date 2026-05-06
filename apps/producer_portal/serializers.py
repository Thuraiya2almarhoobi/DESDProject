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

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

from .models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
)

STORAGE_TIPS_MAX_LENGTH = 700
url_validator = URLValidator(schemes=["http", "https"])


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
            "is_organic",
            "organic_certification",
            "allergen_information",
            "storage_tips",
            "storage_tips_ai_generated",
            "harvest_date",
            "image_url",
            "is_surplus",
            "surplus_discount_percent",
            "surplus_expires_at",
            "surplus_best_before",
            "surplus_note",
            "is_visible_to_customers",
            "created_at",
            "updated_at",
        ]

    def get_producer_name(self, obj: ProducerProduct) -> str:
        profile = getattr(obj.producer, "producer_profile", None)
        if profile and profile.business_name:
            return profile.business_name
        orders_profile = getattr(obj.producer, "orders_producer_profile", None)
        if orders_profile and orders_profile.business_name:
            return orders_profile.business_name
        email = (obj.producer.email or "").lower()
        local_part = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ").strip()
        if local_part:
            return " ".join(part.capitalize() for part in local_part.split())
        return "Producer"

    def get_producer_location(self, obj: ProducerProduct) -> str:
        profile = getattr(obj.producer, "producer_profile", None)
        address = getattr(profile, "address", None) if profile else None
        if address:
            return ", ".join(part for part in [address.city, address.postcode] if part) or "Bristol, UK"
        orders_profile = getattr(obj.producer, "orders_producer_profile", None)
        if orders_profile and orders_profile.postcode:
            return orders_profile.postcode
        return "Bristol, UK"

    def get_is_currently_in_season(self, obj: ProducerProduct) -> bool:
        return obj.is_currently_in_season()

    def validate_name(self, value: str) -> str:
        normalized = (value or "").strip()
        if len(normalized) < 3:
            raise serializers.ValidationError("Product name must be at least 3 characters.")
        return normalized

    def validate_category(self, value: str) -> str:
        normalized = (value or "").strip()
        if len(normalized) < 2:
            raise serializers.ValidationError("Category is required.")
        return normalized

    def validate_description(self, value: str) -> str:
        normalized = (value or "").strip()
        if len(normalized) < 12 or len(normalized.split()) < 5:
            raise serializers.ValidationError("Description must include at least five words.")
        return normalized

    def validate_image_url(self, value: str) -> str:
        normalized = (value or "").strip()
        if normalized:
            try:
                url_validator(normalized)
            except DjangoValidationError as exc:
                raise serializers.ValidationError("Image URL must start with http:// or https://.") from exc
        return normalized

    def validate_allergen_information(self, value: str) -> str:
        normalized = (value or "").strip()
        return normalized or "No common allergens"

    def validate_storage_tips(self, value: str) -> str:
        normalized = (value or "").strip()
        if len(normalized) > STORAGE_TIPS_MAX_LENGTH:
            raise serializers.ValidationError(
                f"Storage guidance must be {STORAGE_TIPS_MAX_LENGTH} characters or fewer."
            )
        return normalized

    def validate_organic_certification(self, value: str) -> str:
        return (value or "").strip()

    def validate_surplus_best_before(self, value: str) -> str:
        return (value or "").strip()

    def validate_surplus_note(self, value: str) -> str:
        return (value or "").strip()

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        availability = attrs.get("availability", getattr(instance, "availability", None))
        season_start_month = attrs.get("season_start_month", getattr(instance, "season_start_month", None))
        season_end_month = attrs.get("season_end_month", getattr(instance, "season_end_month", None))
        is_surplus = attrs.get("is_surplus", getattr(instance, "is_surplus", False))
        surplus_discount = attrs.get(
            "surplus_discount_percent",
            getattr(instance, "surplus_discount_percent", None),
        )
        is_organic = attrs.get("is_organic", getattr(instance, "is_organic", False))
        price = attrs.get("price", getattr(instance, "price", None))
        stock_quantity = attrs.get("stock_quantity", getattr(instance, "stock_quantity", None))
        low_stock_threshold = attrs.get("low_stock_threshold", getattr(instance, "low_stock_threshold", None))
        organic_certification = attrs.get("organic_certification", getattr(instance, "organic_certification", ""))

        if price is not None and price <= 0:
            raise serializers.ValidationError({"price": "Price must be greater than zero."})
        if stock_quantity is not None and stock_quantity < 0:
            raise serializers.ValidationError({"stock_quantity": "Stock quantity must be zero or greater."})
        if low_stock_threshold is not None and low_stock_threshold < 1:
            raise serializers.ValidationError({"low_stock_threshold": "Low-stock threshold must be 1 or greater."})
        if is_organic and not str(organic_certification or "").strip():
            raise serializers.ValidationError(
                {"organic_certification": "Certification body or reference is required for organic products."}
            )

        if availability == "in_season":
            errors = {}
            if not season_start_month:
                errors["season_start_month"] = "Season start month is required for seasonal products."
            if not season_end_month:
                errors["season_end_month"] = "Season end month is required for seasonal products."
            if errors:
                raise serializers.ValidationError(errors)
        if is_surplus and surplus_discount is None:
            raise serializers.ValidationError(
                {"surplus_discount_percent": "Surplus discount is required when item is marked surplus."}
            )
        if not is_surplus:
            attrs["surplus_discount_percent"] = None
            attrs["surplus_expires_at"] = None
            attrs["surplus_best_before"] = ""
            attrs["surplus_note"] = ""
        if not is_organic:
            attrs["organic_certification"] = ""
        storage_tips = attrs.get("storage_tips", getattr(instance, "storage_tips", ""))
        if not (storage_tips or "").strip():
            attrs["storage_tips_ai_generated"] = False

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
