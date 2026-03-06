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
)


class ProducerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producer
        fields = ["id", "business_name", "postcode", "lead_time_hours"]


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
    payment_method = serializers.CharField(max_length=50, default="test_card")
    payment_token = serializers.CharField(max_length=120, required=False, allow_blank=True)
    delivery_date = serializers.DateField(required=False)
    producer_delivery_dates = serializers.DictField(
        child=serializers.DateField(), required=False, help_text="Mapping producer_id -> YYYY-MM-DD"
    )


class ProducerSubOrderSerializer(serializers.ModelSerializer):
    producer = ProducerSerializer(read_only=True)

    class Meta:
        model = ProducerSubOrder
        fields = [
            "id",
            "producer",
            "status",
            "delivery_date",
            "subtotal_amount",
            "commission_amount",
            "payout_amount",
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
        return min(dates)

    def get_delivery_date_to(self, obj: Order):
        dates = self._delivery_dates(obj)
        if not dates:
            return None
        return max(dates)


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
            "subtotal_amount",
            "commission_rate",
            "commission_amount",
            "producer_payout_total",
            "total_amount",
            "payment_method",
            "payment_reference",
            "created_at",
            "sub_orders",
            "items",
        ]
