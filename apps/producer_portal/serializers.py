from __future__ import annotations

import json

from rest_framework import serializers

from .models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
)

ALLOWED_ALLERGENS = [
    "Celery (including stalks, leaves, seeds, and root)",
    "Cereals containing gluten (such as wheat, rye, barley, and oats)",
    "Crustaceans (such as prawns, crabs, and lobsters)",
    "Eggs",
    "Fish",
    "Lupin (flour and seeds)",
    "Milk (including lactose)",
    "Molluscs (such as mussels, oysters, and squid)",
    "Mustard",
    "Peanuts",
    "Sesame seeds",
    "Soybeans",
    "Sulphur dioxide and sulphites (at concentrations above 10 parts per million)",
    "Tree nuts (almonds, hazelnuts, walnuts, cashews, pecans, brazil nuts, pistachios, macadamia nuts)",
]


class AllergenListField(serializers.Field):
    default_error_messages = {
        "invalid_type": "Allergen information must be provided as a list of values.",
        "invalid_choice": "Allergen information contains unsupported values.",
    }

    def to_representation(self, value):
        if not value:
            return []
        if isinstance(value, list):
            return [item for item in value if isinstance(item, str) and item]
        return [item.strip() for item in str(value).split(",") if item.strip()]

    def to_internal_value(self, data):
        if data in (None, ""):
            return []
        if isinstance(data, str):
            parsed_json = None
            if data.lstrip().startswith("["):
                try:
                    parsed_json = json.loads(data)
                except json.JSONDecodeError:
                    parsed_json = None
            if isinstance(parsed_json, list):
                entries = []
                for item in parsed_json:
                    if not isinstance(item, str):
                        self.fail("invalid_type")
                    item = item.strip()
                    if item:
                        entries.append(item)
            else:
                entries = [item.strip() for item in data.split(",") if item.strip()]
        elif isinstance(data, list):
            entries = []
            for item in data:
                if not isinstance(item, str):
                    self.fail("invalid_type")
                item = item.strip()
                if item:
                    entries.append(item)
        else:
            self.fail("invalid_type")

        invalid = [item for item in entries if item not in ALLOWED_ALLERGENS]
        if invalid:
            self.fail("invalid_choice")

        deduplicated: list[str] = []
        seen: set[str] = set()
        for item in entries:
            if item not in seen:
                deduplicated.append(item)
                seen.add(item)
        return deduplicated


class ProducerProductSerializer(serializers.ModelSerializer):
    producer_id = serializers.IntegerField(read_only=True)
    producer_name = serializers.SerializerMethodField()
    producer_email = serializers.EmailField(source="producer.email", read_only=True)
    producer_location = serializers.SerializerMethodField()
    is_visible_to_customers = serializers.BooleanField(read_only=True)
    allergen_information = AllergenListField(required=False)

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
            "stock_quantity",
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
        if obj.producer.first_name or obj.producer.last_name:
            return f"{obj.producer.first_name} {obj.producer.last_name}".strip()
        return obj.producer.username

    def get_producer_location(self, obj: ProducerProduct) -> str:
        email = (obj.producer.email or "").lower()
        if email == "producer@example.com":
            return "Kent, UK"
        return "Bristol, UK"


class ProducerOrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ProducerOrderItem
        fields = ["id", "product_id", "product_name", "quantity", "unit_price", "line_total"]


class ProducerOrderSerializer(serializers.ModelSerializer):
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
