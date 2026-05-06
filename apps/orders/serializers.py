"""
DESD Marketplace documentation.

File role:
    Validates API payloads and converts Django model instances into JSON-friendly response shapes.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from decimal import Decimal

from django.db.models import Avg, Count, Q
from rest_framework import serializers

from apps.community.models import ProductReview
from apps.community.review_policy import find_matching_orders_product, resolve_verified_purchase_status
from apps.geo.services import get_postcode_coordinates, get_user_default_postcode, haversine_miles

from .marketplace_sync import (
    default_marketplace_image_url,
    get_or_create_catalog_product_mirror,
    matching_producer_portal_product,
    product_is_organic,
)
from .models import (
    CartItem,
    CustomerProfile,
    Order,
    OrderItem,
    Producer,
    ProducerSubOrder,
    ProducerSubOrderStatusHistory,
    Product,
    RecurringOrderTemplate,
    RecurringOrderTemplateItem,
    RecurringOrderInstanceOverride,
    RecurringOrderInstanceOverrideItem,
)
class ProducerSerializer(serializers.ModelSerializer):
    """
    Documents the `ProducerSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Producer
        fields = [
            "id",
            "user_id",
            "business_name",
            "contact_email",
            "phone",
            "postcode",
            "lead_time_hours",
        ]


class ProductSerializer(serializers.ModelSerializer):
    """
    Documents the `ProductSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
            "season_start_month",
            "season_end_month",
            "harvest_date",
            "allergen_info",
        ]


class MarketplaceProductSerializer(serializers.ModelSerializer):
    """
    Documents the `MarketplaceProductSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer_id = serializers.IntegerField(source="producer.id", read_only=True)
    producer_user_id = serializers.IntegerField(source="producer.user.id", read_only=True, allow_null=True)
    producer_name = serializers.CharField(source="producer.business_name", read_only=True)
    producer_location = serializers.SerializerMethodField()
    producer_description = serializers.SerializerMethodField()
    producer_delivery_lead_time = serializers.IntegerField(source="producer.lead_time_hours", read_only=True)
    producer_postcode = serializers.CharField(source="producer.postcode", read_only=True)
    producer_latitude = serializers.SerializerMethodField()
    producer_longitude = serializers.SerializerMethodField()
    availability = serializers.SerializerMethodField()
    seasonal_dates = serializers.SerializerMethodField()
    season_start_month = serializers.IntegerField(read_only=True)
    season_end_month = serializers.IntegerField(read_only=True)
    is_organic = serializers.SerializerMethodField()
    organic_certification = serializers.SerializerMethodField()
    allergens = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    food_miles = serializers.SerializerMethodField()
    is_surplus = serializers.SerializerMethodField()
    surplus_discount = serializers.SerializerMethodField()
    surplus_original_price = serializers.SerializerMethodField()
    surplus_expires_at = serializers.SerializerMethodField()
    surplus_best_before = serializers.SerializerMethodField()
    surplus_note = serializers.SerializerMethodField()
    storage_tips = serializers.SerializerMethodField()
    storage_tips_ai_generated = serializers.SerializerMethodField()
    recipe_ideas = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    verified_review_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "price",
            "unit",
            "producer_id",
            "producer_user_id",
            "producer_name",
            "producer_location",
            "producer_description",
            "producer_delivery_lead_time",
            "producer_postcode",
            "producer_latitude",
            "producer_longitude",
            "category",
            "harvest_date",
            "availability",
            "seasonal_dates",
            "season_start_month",
            "season_end_month",
            "is_organic",
            "organic_certification",
            "allergens",
            "image_url",
            "stock",
            "food_miles",
            "is_surplus",
            "surplus_discount",
            "surplus_original_price",
            "surplus_expires_at",
            "surplus_best_before",
            "surplus_note",
            "storage_tips",
            "storage_tips_ai_generated",
            "recipe_ideas",
            "average_rating",
            "review_count",
            "verified_review_count",
        ]

    def _producer_product(self, obj: Product):
        cache = self.context.setdefault("_producer_product_cache", {})
        if obj.id not in cache:
            cache[obj.id] = matching_producer_portal_product(obj)
        return cache[obj.id]

    def _review_summary(self, obj: Product) -> dict:
        cache = self.context.setdefault("_review_summary_cache", {})
        if obj.id not in cache:
            catalog_product = get_or_create_catalog_product_mirror(obj)
            summary = ProductReview.objects.filter(
                product=catalog_product,
                moderation_status=ProductReview.ModerationStatus.PUBLISHED,
            ).aggregate(
                average_rating=Avg("rating"),
                review_count=Count("id"),
                verified_review_count=Count("id", filter=Q(verified_purchase=True)),
            )
            cache[obj.id] = {
                "average_rating": summary["average_rating"],
                "review_count": summary["review_count"] or 0,
                "verified_review_count": summary["verified_review_count"] or 0,
            }
        return cache[obj.id]
    def get_producer_location(self, obj: Product) -> str:
        producer_user = getattr(obj.producer, "user", None)
        producer_profile = getattr(producer_user, "producer_profile", None) if producer_user else None
        address = getattr(producer_profile, "address", None) if producer_profile else None
        if address and address.city:
            return f"{address.city}, UK"
        if obj.producer.postcode:
            return obj.producer.postcode
        return "Bristol, UK"

    def get_producer_description(self, obj: Product) -> str:
        producer_user = getattr(obj.producer, "user", None)
        producer_profile = getattr(producer_user, "producer_profile", None) if producer_user else None
        if producer_profile and producer_profile.farm_origin_text:
            return producer_profile.farm_origin_text
        return f"Fresh produce from {obj.producer.business_name}."

    def get_producer_latitude(self, obj: Product) -> float | None:
        coordinates = get_postcode_coordinates(obj.producer.postcode)
        if not coordinates:
            return None
        return coordinates[0]

    def get_producer_longitude(self, obj: Product) -> float | None:
        coordinates = get_postcode_coordinates(obj.producer.postcode)
        if not coordinates:
            return None
        return coordinates[1]

    def get_availability(self, obj: Product) -> str:
        return obj.effective_availability()

    def get_seasonal_dates(self, obj: Product) -> str:
        if obj.seasonal_window_label:
            return obj.seasonal_window_label
        return "Current season" if obj.in_season else "Year-round"

    def get_is_organic(self, obj: Product) -> bool:
        producer_product = self._producer_product(obj)
        inferred_organic = product_is_organic(name=obj.name, description=obj.description)
        if producer_product is not None:
            return bool(getattr(producer_product, "is_organic", False)) or inferred_organic
        return inferred_organic

    def get_organic_certification(self, obj: Product) -> str:
        producer_product = self._producer_product(obj)
        inferred_organic = product_is_organic(name=obj.name, description=obj.description)
        if producer_product is None:
            return "Organic" if inferred_organic else ""
        certification = (getattr(producer_product, "organic_certification", "") or "").strip()
        if certification:
            return certification
        return "Organic" if bool(getattr(producer_product, "is_organic", False)) or inferred_organic else ""

    def get_allergens(self, obj: Product) -> list[str]:
        tokens = [token.strip() for token in (obj.allergen_info or "").split(",") if token.strip()]
        return [token for token in tokens if token.lower() not in {"no common allergens", "none", "no allergens"}]

    def get_image_url(self, obj: Product) -> str:
        producer_product = self._producer_product(obj)
        if producer_product and producer_product.image_url:
            return producer_product.image_url
        return default_marketplace_image_url(obj.id)

    def get_stock(self, obj: Product) -> int:
        return max(0, int(obj.stock_quantity))

    def get_food_miles(self, obj: Product) -> float:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        customer_postcode = get_user_default_postcode(user) if user and user.is_authenticated else ""
        if not customer_postcode or not obj.producer.postcode:
            return 0

        customer_coords = get_postcode_coordinates(customer_postcode)
        producer_coords = get_postcode_coordinates(obj.producer.postcode)
        if not customer_coords or not producer_coords:
            return 0

        return haversine_miles(
            customer_coords[0],
            customer_coords[1],
            producer_coords[0],
            producer_coords[1],
        )

    def get_is_surplus(self, obj: Product) -> bool:
        producer_product = self._producer_product(obj)
        return bool(getattr(producer_product, "is_surplus", False))

    def get_surplus_discount(self, obj: Product) -> int | None:
        producer_product = self._producer_product(obj)
        return getattr(producer_product, "surplus_discount_percent", None)

    def get_surplus_original_price(self, obj: Product) -> Decimal | None:
        discount = self.get_surplus_discount(obj)
        if not discount or discount >= 100:
            return None
        return (obj.price / (Decimal("1.00") - (Decimal(str(discount)) / Decimal("100.00")))).quantize(
            Decimal("0.01")
        )

    def get_surplus_expires_at(self, obj: Product):
        producer_product = self._producer_product(obj)
        return getattr(producer_product, "surplus_expires_at", None)

    def get_surplus_best_before(self, obj: Product) -> str:
        producer_product = self._producer_product(obj)
        return getattr(producer_product, "surplus_best_before", "") or ""

    def get_surplus_note(self, obj: Product) -> str:
        producer_product = self._producer_product(obj)
        return getattr(producer_product, "surplus_note", "") or ""

    def get_storage_tips(self, obj: Product) -> str:
        producer_product = self._producer_product(obj)
        if producer_product is None:
            return ""
        return (getattr(producer_product, "storage_tips", "") or "").strip()

    def get_storage_tips_ai_generated(self, obj: Product) -> bool:
        producer_product = self._producer_product(obj)
        if producer_product is None:
            return False
        return bool(
            (getattr(producer_product, "storage_tips", "") or "").strip()
            and getattr(producer_product, "storage_tips_ai_generated", False)
        )

    def get_recipe_ideas(self, obj: Product) -> list[str]:
        return list(
            obj.product_recipes.select_related("recipe")
            .order_by("recipe__title")
            .values_list("recipe__title", flat=True)
        )

    def get_average_rating(self, obj: Product):
        average_rating = self._review_summary(obj)["average_rating"]
        return round(float(average_rating), 1) if average_rating is not None else None

    def get_review_count(self, obj: Product) -> int:
        return int(self._review_summary(obj)["review_count"])

    def get_verified_review_count(self, obj: Product) -> int:
        return int(self._review_summary(obj)["verified_review_count"])


class PendingReviewModerationSerializer(serializers.ModelSerializer):
    """
    Documents the `PendingReviewModerationSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    order_product_id = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    producer_name = serializers.CharField(source="product.producer.name", read_only=True)
    has_verified_purchase = serializers.SerializerMethodField()
    purchase_label = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = [
            "id",
            "order_product_id",
            "product_name",
            "producer_name",
            "title",
            "reviewer_name",
            "rating",
            "comment",
            "moderation_status",
            "moderation_reason",
            "has_verified_purchase",
            "purchase_label",
            "created_at",
        ]

    def _matching_order_product(self, obj: ProductReview):
        cache = self.context.setdefault("_pending_review_order_product_cache", {})
        if obj.product_id not in cache:
            cache[obj.product_id] = find_matching_orders_product(obj.product)
        return cache[obj.product_id]

    def get_order_product_id(self, obj: ProductReview) -> int | None:
        order_product = self._matching_order_product(obj)
        return getattr(order_product, "id", None)

    def get_has_verified_purchase(self, obj: ProductReview) -> bool:
        order_product = self._matching_order_product(obj)
        return resolve_verified_purchase_status(
            user=obj.user,
            catalog_product=obj.product,
            order_product=order_product,
        )

    def get_purchase_label(self, obj: ProductReview) -> str:
        return "Verified purchase" if self.get_has_verified_purchase(obj) else "Unverified purchase"

class CustomerProfileSerializer(serializers.ModelSerializer):
    """
    Documents the `CustomerProfileSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = CustomerProfile
        fields = ["full_name", "phone", "delivery_address", "postcode"]


class CartItemSerializer(serializers.ModelSerializer):
    """
    Documents the `CartItemSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
    """
    Documents the `CheckoutRequestSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    delivery_address = serializers.CharField()
    customer_postcode = serializers.CharField(max_length=12)
    special_instructions = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.CharField(max_length=50, default="test_card")
    payment_token = serializers.CharField(max_length=120, required=False, allow_blank=True)
    success_url = serializers.CharField(required=False, allow_blank=True, max_length=2048)
    cancel_url = serializers.CharField(required=False, allow_blank=True, max_length=2048)
    selected_cart_item_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )
    delivery_date = serializers.DateField(required=False)
    producer_delivery_dates = serializers.DictField(
        child=serializers.DateField(), required=False, help_text="Mapping producer_id -> YYYY-MM-DD"
    )


class ProducerSubOrderStatusHistorySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = ProducerSubOrderStatusHistory
        fields = [
            "id",
            "previous_status",
            "new_status",
            "note",
            "actor_email",
            "created_at",
        ]


class ProducerSubOrderSerializer(serializers.ModelSerializer):
    """
    Documents the `ProducerSubOrderSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer = ProducerSerializer(read_only=True)
    producer_contact_email = serializers.CharField(source="producer.contact_email", read_only=True)
    producer_contact_phone = serializers.CharField(source="producer.phone", read_only=True)
    delivery = serializers.SerializerMethodField()
    status_history = ProducerSubOrderStatusHistorySerializer(many=True, read_only=True)

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
            "delivery",
            "status_history",
        ]

    def get_delivery(self, obj: ProducerSubOrder):
        from apps.delivery.serializers import DeliveryJobSerializer
        from apps.delivery.services import latest_delivery_job

        delivery_job = latest_delivery_job(obj, sync_for_read=True)
        if delivery_job is None:
            return None
        return DeliveryJobSerializer(delivery_job).data


class OrderItemSerializer(serializers.ModelSerializer):
    """
    Documents the `OrderItemSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    product_id = serializers.IntegerField(source="product.id", read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_id",
            "product_name",
            "producer_name",
            "unit",
            "quantity",
            "unit_price",
            "line_total",
        ]


class OrderSummarySerializer(serializers.ModelSerializer):
    """
    Documents the `OrderSummarySerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer_names = serializers.SerializerMethodField()
    delivery_date_from = serializers.SerializerMethodField()
    delivery_date_to = serializers.SerializerMethodField()
    sub_orders = ProducerSubOrderSerializer(many=True, read_only=True)

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
            "sub_orders",
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
    """
    Documents the `OrderDetailSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    sub_orders = ProducerSubOrderSerializer(many=True, read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    payment_reference = serializers.SerializerMethodField()
    payment_reference_masked = serializers.SerializerMethodField()

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
            "payment_reference_masked",
            "is_recurring_instance",
            "recurring_scheduled_for",
            "created_at",
            "sub_orders",
            "items",
        ]

    def get_payment_reference_masked(self, obj: Order) -> str:
        reference = obj.payment_reference or ""
        if not reference:
            return ""
        if len(reference) <= 7:
            return f"{reference[:2]}***"
        return f"{reference[:4]}***{reference[-3:]}"

    def get_payment_reference(self, obj: Order) -> str:
        return self.get_payment_reference_masked(obj)


class RecurringOrderTemplateItemSerializer(serializers.ModelSerializer):
    """
    Documents the `RecurringOrderTemplateItemSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    producer_id = serializers.IntegerField(source="product.producer.id", read_only=True)
    producer_name = serializers.CharField(source="product.producer.business_name", read_only=True)
    producer_phone = serializers.CharField(source="product.producer.phone", read_only=True)
    producer_email = serializers.CharField(source="product.producer.contact_email", read_only=True)
    available_stock = serializers.DecimalField(
        source="product.stock_quantity",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

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
            "available_stock",
            "default_quantity",
        ]


class RecurringOrderTemplateSerializer(serializers.ModelSerializer):
    """
    Documents the `RecurringOrderTemplateSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
    """
    Documents the `RecurringOrderTemplateCreateSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    frequency = serializers.ChoiceField(choices=RecurringOrderTemplate.Frequency.choices, default="weekly")
    order_day = serializers.IntegerField(min_value=0, max_value=6)
    delivery_day = serializers.IntegerField(min_value=0, max_value=6)
    delivery_address = serializers.CharField()
    customer_postcode = serializers.CharField(max_length=12)
    special_instructions = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.CharField(max_length=50, default="test_card")
    payment_token = serializers.CharField(max_length=120, required=False, allow_blank=True)
    success_url = serializers.CharField(required=False, allow_blank=True, max_length=2048)
    cancel_url = serializers.CharField(required=False, allow_blank=True, max_length=2048)
    selected_cart_item_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )
    delivery_date = serializers.DateField(required=False)
    producer_delivery_dates = serializers.DictField(
        child=serializers.DateField(), required=False, help_text="Mapping producer_id -> YYYY-MM-DD"
    )


class RecurringOrderTemplateUpdateSerializer(serializers.Serializer):
    """
    Documents the `RecurringOrderTemplateUpdateSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    frequency = serializers.ChoiceField(
        choices=RecurringOrderTemplate.Frequency.choices, required=False
    )
    order_day = serializers.IntegerField(min_value=0, max_value=6, required=False)
    delivery_day = serializers.IntegerField(min_value=0, max_value=6, required=False)
    next_order_date = serializers.DateField(required=False)
    is_paused = serializers.BooleanField(required=False)
    is_cancelled = serializers.BooleanField(required=False)


class RecurringOrderInstanceOverrideItemInputSerializer(serializers.Serializer):
    """
    Documents the `RecurringOrderInstanceOverrideItemInputSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )


class RecurringOrderInstanceOverrideSerializer(serializers.ModelSerializer):
    """
    Documents the `RecurringOrderInstanceOverrideSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
    """
    Documents the `RecurringOrderNextInstancePatchSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    items = RecurringOrderInstanceOverrideItemInputSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one override item is required.")
        product_ids = [row["product_id"] for row in value]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError("Duplicate products are not allowed.")
        return value
