from decimal import Decimal

from rest_framework import serializers

from .models import (
    CartItem,
    CustomerProfile,
    Order,
    OrderItem,
    Producer,
    ProducerSubOrder,
    Product,
    RecurringOrderTemplate,
    RecurringOrderTemplateItem,
    RecurringOrderInstanceOverride,
    RecurringOrderInstanceOverrideItem,
)


class ProducerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producer
        fields = [
            "id",
            "business_name",
            "contact_email",
            "phone",
            "postcode",
            "lead_time_hours",
        ]


class ProductSerializer(serializers.ModelSerializer):
    producer = ProducerSerializer(read_only=True)
    producer_id = serializers.PrimaryKeyRelatedField(
        source="producer", queryset=Producer.objects.all(), write_only=True, required=False
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "producer",
            "producer_id",
            "name",
            "category",
            "description",
            "unit",
            "price",
            "stock_quantity",
            "is_available",
            "in_season",
            "harvest_date",
            "allergen_info",
        ]


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = ["full_name", "phone", "delivery_address", "postcode"]


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=Product.objects.select_related("producer").all(), write_only=True
    )
    unit_price = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_id", "quantity", "unit_price", "line_total"]

    def get_unit_price(self, obj: CartItem) -> Decimal:
        return obj.unit_price

    def get_line_total(self, obj: CartItem) -> Decimal:
        return obj.line_total


class CheckoutRequestSerializer(serializers.Serializer):
    delivery_address = serializers.CharField()
    customer_postcode = serializers.CharField(max_length=12)
    special_instructions = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.CharField(max_length=50, default="test_card")
    payment_token = serializers.CharField(max_length=120, required=False, allow_blank=True)
    delivery_date = serializers.DateField(required=False)
    producer_delivery_dates = serializers.DictField(
        child=serializers.DateField(), required=False, help_text="Mapping producer_id -> YYYY-MM-DD"
    )


class ProducerSubOrderSerializer(serializers.ModelSerializer):
    producer = ProducerSerializer(read_only=True)
    producer_contact_email = serializers.CharField(source="producer.contact_email", read_only=True)
    producer_contact_phone = serializers.CharField(source="producer.phone", read_only=True)

    class Meta:
        model = ProducerSubOrder
        fields = [
            "id",
            "producer",
            "producer_contact_email",
            "producer_contact_phone",
            "status",
            "delivery_date",
            "subtotal_amount",
            "commission_amount",
            "payout_amount",
            "notes",
        ]


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_name",
            "producer_name",
            "unit",
            "quantity",
            "unit_price",
            "line_total",
        ]


class OrderSummarySerializer(serializers.ModelSerializer):
    producer_names = serializers.SerializerMethodField()
    delivery_date_from = serializers.SerializerMethodField()
    delivery_date_to = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "status",
            "payment_status",
            "created_at",
            "subtotal_amount",
            "commission_amount",
            "total_amount",
            "producer_names",
            "delivery_date_from",
            "delivery_date_to",
        ]

    def get_producer_names(self, obj: Order) -> list[str]:
        return list(obj.sub_orders.select_related("producer").values_list("producer__business_name", flat=True))

    def _delivery_dates(self, obj: Order) -> list:
        return list(obj.sub_orders.values_list("delivery_date", flat=True))

    def get_delivery_date_from(self, obj: Order):
        dates = self._delivery_dates(obj)
        if not dates:
            return None
        return min(dates).isoformat()

    def get_delivery_date_to(self, obj: Order):
        dates = self._delivery_dates(obj)
        if not dates:
            return None
        return max(dates).isoformat()


class OrderDetailSerializer(serializers.ModelSerializer):
    sub_orders = ProducerSubOrderSerializer(many=True, read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "status",
            "payment_status",
            "delivery_address",
            "customer_postcode",
            "special_instructions",
            "subtotal_amount",
            "commission_rate",
            "commission_amount",
            "producer_payout_total",
            "total_amount",
            "payment_method",
            "payment_reference",
            "is_recurring_instance",
            "recurring_scheduled_for",
            "created_at",
            "sub_orders",
            "items",
        ]


class RecurringOrderTemplateItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    producer_id = serializers.IntegerField(source="product.producer.id", read_only=True)
    producer_name = serializers.CharField(source="product.producer.business_name", read_only=True)
    producer_phone = serializers.CharField(source="product.producer.phone", read_only=True)
    producer_email = serializers.CharField(source="product.producer.contact_email", read_only=True)

    class Meta:
        model = RecurringOrderTemplateItem
        fields = [
            "id",
            "product_id",
            "product_name",
            "producer_id",
            "producer_name",
            "producer_phone",
            "producer_email",
            "default_quantity",
        ]


class RecurringOrderTemplateSerializer(serializers.ModelSerializer):
    items = RecurringOrderTemplateItemSerializer(many=True, read_only=True)

    class Meta:
        model = RecurringOrderTemplate
        fields = [
            "id",
            "frequency",
            "order_day",
            "delivery_day",
            "next_order_date",
            "delivery_address",
            "customer_postcode",
            "payment_method",
            "is_paused",
            "is_cancelled",
            "last_generated_at",
            "created_at",
            "updated_at",
            "items",
        ]


class RecurringOrderTemplateCreateSerializer(serializers.Serializer):
    frequency = serializers.ChoiceField(choices=RecurringOrderTemplate.Frequency.choices, default="weekly")
    order_day = serializers.IntegerField(min_value=0, max_value=6)
    delivery_day = serializers.IntegerField(min_value=0, max_value=6)
    delivery_address = serializers.CharField()
    customer_postcode = serializers.CharField(max_length=12)
    special_instructions = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.CharField(max_length=50, default="test_card")
    payment_token = serializers.CharField(max_length=120, required=False, allow_blank=True)
    delivery_date = serializers.DateField(required=False)
    producer_delivery_dates = serializers.DictField(
        child=serializers.DateField(), required=False, help_text="Mapping producer_id -> YYYY-MM-DD"
    )


class RecurringOrderTemplateUpdateSerializer(serializers.Serializer):
    frequency = serializers.ChoiceField(
        choices=RecurringOrderTemplate.Frequency.choices, required=False
    )
    order_day = serializers.IntegerField(min_value=0, max_value=6, required=False)
    delivery_day = serializers.IntegerField(min_value=0, max_value=6, required=False)
    next_order_date = serializers.DateField(required=False)
    is_paused = serializers.BooleanField(required=False)
    is_cancelled = serializers.BooleanField(required=False)


class RecurringOrderInstanceOverrideItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))


class RecurringOrderInstanceOverrideSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = RecurringOrderInstanceOverride
        fields = ["id", "scheduled_order_date", "created_at", "items"]

    def get_items(self, obj):
        return [
            {
                "product_id": item.product_id,
                "product_name": item.product.name,
                "quantity": item.quantity,
            }
            for item in obj.items.select_related("product").all()
        ]


class RecurringOrderNextInstancePatchSerializer(serializers.Serializer):
    items = RecurringOrderInstanceOverrideItemInputSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one override item is required.")
        product_ids = [row["product_id"] for row in value]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError("Duplicate products are not allowed.")
        return value
