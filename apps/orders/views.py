"""
DESD Marketplace documentation.

File role:
    Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_CEILING

from django.db.models import Q
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.serializers import ProductReviewCreateSerializer, ProductReviewSerializer
from apps.catalog.serializers import ProductReviewProducerResponseSerializer
from apps.catalog.serializers import ProductReviewModerationSerializer
from apps.catalog.serializers import ProductReviewUpdateSerializer
from apps.accounts.models import User
from apps.community.review_policy import get_review_eligibility
from apps.community.models import ProductReview
from bristol_marketplace.search_utils import filter_queryset_with_fuzzy_fallback

from .marketplace_sync import get_or_create_catalog_product_mirror, matching_producer_portal_product, product_is_organic
from .models import (
    CartItem,
    CustomerProfile,
    FavoriteProducer,
    Order,
    Producer,
    ProducerSubOrder,
    ProducerSubOrderStatusHistory,
    Product,
    ProductAllergenAcknowledgement,
    UserNotification,
)
from .serializers import (
    CheckoutRequestSerializer,
    CustomerProfileSerializer,
    MarketplaceProductSerializer,
    OrderDetailSerializer,
    OrderSummarySerializer,
    PendingReviewModerationSerializer,
    ProducerSerializer,
    ProductSerializer,
)
from .services import (
    MAX_ORDER_ITEM_QUANTITY,
    build_cart_payload,
    checkout_cart,
    checkout_cart_with_stripe_reservation,
    get_or_create_cart,
    reorder_order_to_cart,
)

# Core ordering and marketplace transaction views.
# This file covers browsing helpers, cart operations, checkout, order history,
# reviews, and producer-facing sub-order workflow.

TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def _filter_order_products_by_effective_availability(queryset, allowed_availabilities: set[str]):
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_filter_order_products_by_effective_availability` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    matching_ids = []
    for product in queryset:
        if product.effective_availability() in allowed_availabilities:
            matching_ids.append(product.id)
    return queryset.filter(id__in=matching_ids)


def _parse_quantity(value) -> Decimal:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_parse_quantity` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValueError("Quantity must be numeric.")
    if quantity <= Decimal("0"):
        raise ValueError("Quantity must be greater than zero.")
    return quantity.quantize(Decimal("0.01"))


def _parse_boolean(value: str | None) -> bool | None:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_parse_boolean` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    return None


def _parse_decimal(value: str | None) -> Decimal | None:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_parse_decimal` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    if value is None:
        return None
    try:
        return Decimal(value.strip())
    except (InvalidOperation, ValueError):
        return None


def _quantity_cap_for_user_and_stock(user, stock_quantity: Decimal) -> Decimal:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_quantity_cap_for_user_and_stock` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    if getattr(user, "role", None) in {User.Role.COMMUNITY, User.Role.RESTAURANT}:
        return stock_quantity
    return min(MAX_ORDER_ITEM_QUANTITY, stock_quantity)


def _enforce_cart_quantity_cap(quantity: Decimal, *, user, stock_quantity: Decimal) -> None:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_enforce_cart_quantity_cap` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    if quantity > _quantity_cap_for_user_and_stock(user, stock_quantity):
        raise ValueError(f"Maximum quantity per product is {MAX_ORDER_ITEM_QUANTITY.quantize(Decimal('1'))}.")


PRODUCER_SUBORDER_ALLOWED_TRANSITIONS = {
    Order.Status.PENDING: {Order.Status.CONFIRMED, Order.Status.CANCELLED},
    Order.Status.CONFIRMED: {Order.Status.READY, Order.Status.CANCELLED},
    Order.Status.READY: {Order.Status.DELIVERED, Order.Status.CANCELLED},
    Order.Status.DELIVERED: set(),
    Order.Status.CANCELLED: set(),
}


def _customer_name_for_order(order: Order) -> str:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_customer_name_for_order` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    profile = getattr(order.customer, "orders_customer_profile", None)
    if profile and profile.full_name:
        return profile.full_name
    local_part = (order.customer.email or "customer").split("@")[0]
    if not local_part:
        return "Customer"
    return " ".join(part.capitalize() for part in local_part.replace(".", " ").replace("_", " ").split())


def _allowed_next_statuses(current_status: str) -> list[str]:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_allowed_next_statuses` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    allowed = sorted((str(value) for value in PRODUCER_SUBORDER_ALLOWED_TRANSITIONS.get(current_status, set())))
    return [str(current_status), *allowed]


def _sync_parent_order_status(order: Order) -> None:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_sync_parent_order_status` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    statuses = list(order.sub_orders.values_list("status", flat=True))
    if not statuses:
        return

    unique_statuses = set(statuses)
    next_status = order.status
    if unique_statuses == {Order.Status.DELIVERED}:
        next_status = Order.Status.DELIVERED
    elif unique_statuses == {Order.Status.CANCELLED}:
        next_status = Order.Status.CANCELLED
    elif Order.Status.PENDING in unique_statuses:
        next_status = Order.Status.PENDING
    elif Order.Status.CONFIRMED in unique_statuses:
        next_status = Order.Status.CONFIRMED
    elif Order.Status.READY in unique_statuses:
        next_status = Order.Status.READY

    if next_status != order.status:
        order.status = next_status
        order.save(update_fields=["status", "updated_at"])


def _producer_portal_stock_units(quantity: Decimal) -> int:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_producer_portal_stock_units` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    whole_units = quantity.to_integral_value()
    if quantity == whole_units:
        return int(whole_units)
    # Producer portal inventory stores whole-number stock counts, so round up
    # fractional delivered quantities rather than leaving stock overstated.
    return int(quantity.to_integral_value(rounding=ROUND_CEILING))


def _deduct_producer_portal_stock_for_delivery(sub_order: ProducerSubOrder) -> None:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_deduct_producer_portal_stock_for_delivery` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    payment_record = getattr(sub_order.order, "payment", None)
    if payment_record and bool((payment_record.raw_payload or {}).get("stock_reserved")):
        # stripe reserved stock already got counted so do not deduct twice
        return

    producer_user = sub_order.producer.user
    if producer_user is None:
        return

    from apps.producer_portal.models import ProducerProduct

    for item in sub_order.items.all():
        quantity_to_deduct = _producer_portal_stock_units(item.quantity)
        if quantity_to_deduct <= 0:
            continue

        # first match by name and unit because orders snapshot product data
        producer_product = (
            ProducerProduct.objects.select_for_update()
            .filter(
                producer=producer_user,
                name=item.product_name,
                unit=item.unit,
            )
            .order_by("-updated_at", "-id")
            .first()
        )
        if producer_product is None:
            # fallback by name helps older orders that did not keep unit the same
            producer_product = (
                ProducerProduct.objects.select_for_update()
                .filter(
                    producer=producer_user,
                    name=item.product_name,
                )
                .order_by("-updated_at", "-id")
                .first()
            )
        if producer_product is None:
            continue

        previous = ProducerProduct.objects.get(pk=producer_product.pk)
        producer_product.stock_quantity = max(0, producer_product.stock_quantity - quantity_to_deduct)
        producer_product.save(update_fields=["stock_quantity", "updated_at"])
        try:
            from apps.producer_portal.views import _record_inventory_event, _sync_product_notifications

            # inventory event and notifications are best effort after stock save
            _record_inventory_event(
                producer_product,
                actor=None,
                event_type="delivered_stock_deducted",
                previous=previous,
            )
            _sync_product_notifications(producer_product)
        except Exception:
            pass


def _producer_sub_order_payload(sub_order: ProducerSubOrder) -> dict:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_producer_sub_order_payload` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.delivery.serializers import DeliveryJobSerializer
    from apps.delivery.services import latest_delivery_job

    order = sub_order.order
    # sync for read keeps tracking status fresh before returning order detail
    delivery_job = latest_delivery_job(sub_order, sync_for_read=True)
    return {
        "id": sub_order.id,
        "order_number": order.order_number,
        "status": sub_order.status,
        "allowed_next_statuses": _allowed_next_statuses(sub_order.status),
        "delivery_date": sub_order.delivery_date,
        "subtotal_amount": sub_order.subtotal_amount,
        "commission_amount": sub_order.commission_amount,
        "payout_amount": sub_order.payout_amount,
        "customer_name": _customer_name_for_order(order),
        "customer_email": order.customer.email,
        "delivery_address": order.delivery_address,
        "customer_postcode": order.customer_postcode,
        "special_instructions": order.special_instructions,
        "lead_time_hours": sub_order.producer.lead_time_hours,
        "notes": sub_order.notes,
        "order_created_at": order.created_at,
        "delivery": DeliveryJobSerializer(delivery_job).data if delivery_job else None,
        "status_history": [
            {
                "id": row.id,
                "previous_status": row.previous_status,
                "new_status": row.new_status,
                "note": row.note,
                "actor_email": row.actor.email if row.actor else "",
                "created_at": row.created_at,
            }
            for row in sub_order.status_history.select_related("actor").all()
        ],
        "items": [
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit": item.unit,
                "line_total": item.line_total,
            }
            for item in sub_order.items.all()
        ],
    }


class CustomerProfileAPIView(APIView):
    """Return or update the buyer profile used during ordering."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = CustomerProfile.objects.get_or_create(user=request.user)
        return Response(CustomerProfileSerializer(profile).data)

    def put(self, request):
        profile, _ = CustomerProfile.objects.get_or_create(user=request.user)
        serializer = CustomerProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProducerListCreateAPIView(APIView):
    """List producers relevant to the ordering domain or create producer records."""

    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method.lower() == "get":
            return [permissions.AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        queryset = Producer.objects.filter(is_active=True)
        return Response(ProducerSerializer(queryset, many=True).data)

    def post(self, request):
        serializer = ProducerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producer = serializer.save()
        return Response(ProducerSerializer(producer).data, status=status.HTTP_201_CREATED)


class FavoriteProducerListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        producers = (
            Producer.objects.filter(favorited_by__user=request.user, is_active=True)
            .distinct()
            .order_by("-favorited_by__created_at", "business_name")
        )
        return Response(ProducerSerializer(producers, many=True).data)


class ProducerFavoriteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, producer_id: int):
        producer = get_object_or_404(Producer, pk=producer_id, is_active=True)
        favorite = FavoriteProducer.objects.filter(user=request.user, producer=producer).first()
        return Response(
            {
                "producer_id": producer.id,
                "is_favorite": favorite is not None,
                "is_favourite": favorite is not None,
                "favorited_at": favorite.created_at if favorite else None,
            }
        )

    def post(self, request, producer_id: int):
        producer = get_object_or_404(Producer, pk=producer_id, is_active=True)
        favorite, created = FavoriteProducer.objects.get_or_create(user=request.user, producer=producer)
        return Response(
            {
                "producer_id": producer.id,
                "is_favorite": True,
                "is_favourite": True,
                "favorited_at": favorite.created_at,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, producer_id: int):
        producer = get_object_or_404(Producer, pk=producer_id, is_active=True)
        FavoriteProducer.objects.filter(user=request.user, producer=producer).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductListCreateAPIView(APIView):
    """List marketplace products with filters, or create products where allowed."""

    permission_classes = [permissions.AllowAny]

    def get_permissions(self):
        if self.request.method.lower() == "get":
            return [permissions.AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        queryset = Product.objects.select_related("producer", "producer__user").all()
        producer_id = request.query_params.get("producer_id")
        if producer_id:
            queryset = queryset.filter(producer_id=producer_id)

        search_query = request.query_params.get("search")
        if search_query:
            queryset = filter_queryset_with_fuzzy_fallback(
                queryset,
                search_query=search_query,
                field_names=("name", "description", "producer__business_name", "category", "allergen_info"),
                text_getter=lambda product: " ".join(
                    [
                        product.name or "",
                        product.description or "",
                        product.producer.business_name if product.producer_id else "",
                        product.category or "",
                        product.allergen_info or "",
                    ]
                ),
            )

        category_param = request.query_params.get("category")
        if category_param:
            category_tokens = [token.strip() for token in category_param.split(",") if token.strip()]
            category_filter = Q()
            for token in category_tokens:
                category_filter |= Q(category__iexact=token)
            if category_filter:
                queryset = queryset.filter(category_filter)

        organic_param = _parse_boolean(request.query_params.get("organic"))
        if organic_param is not None:
            organic_ids = []
            for product in queryset:
                producer_product = matching_producer_portal_product(product)
                inferred_organic = product_is_organic(name=product.name, description=product.description)
                is_organic = (
                    bool(getattr(producer_product, "is_organic", False)) or inferred_organic
                    if producer_product is not None
                    else inferred_organic
                )
                if is_organic == organic_param:
                    organic_ids.append(product.id)
            queryset = queryset.filter(id__in=organic_ids)

        min_price = _parse_decimal(request.query_params.get("min_price"))
        if min_price is not None:
            queryset = queryset.filter(price__gte=min_price)

        max_price = _parse_decimal(request.query_params.get("max_price"))
        if max_price is not None:
            queryset = queryset.filter(price__lte=max_price)

        if request.query_params.get("available") == "true":
            queryset = _filter_order_products_by_effective_availability(
                queryset,
                {"in-season", "year-round"},
            )
        serializer = MarketplaceProductSerializer(queryset.order_by("name"), many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class ProductDetailAPIView(generics.RetrieveAPIView):
    """Return one marketplace product with full buyer-facing detail."""

    permission_classes = [permissions.AllowAny]
    serializer_class = MarketplaceProductSerializer

    def get_permissions(self):
        if self.request.method.lower() == "get":
            return [permissions.AllowAny()]
        return [IsAuthenticated()]
    def get_queryset(self):
        return Product.objects.select_related("producer", "producer__user").all().order_by("name")


class ProductAllergenAcknowledgementAPIView(APIView):
    """Persist that the current buyer has reviewed a product's allergen details."""

    permission_classes = [IsAuthenticated]

    def get(self, request, product_id: int):
        product = get_object_or_404(Product, id=product_id)
        acknowledged = ProductAllergenAcknowledgement.objects.filter(
            user=request.user,
            product=product,
        ).exists()
        return Response({"acknowledged": acknowledged})

    def post(self, request, product_id: int):
        product = get_object_or_404(Product, id=product_id)
        acknowledgement, _ = ProductAllergenAcknowledgement.objects.get_or_create(
            user=request.user,
            product=product,
        )
        return Response(
            {
                "acknowledged": True,
                "acknowledged_at": acknowledgement.acknowledged_at,
            },
            status=status.HTTP_200_OK,
        )


class ProductReviewsAPIView(APIView):
    """List or create product reviews tied to marketplace products."""

    permission_classes = [permissions.AllowAny]

    def get_permissions(self):
        if self.request.method.lower() == "get":
            return [permissions.AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, product_id: int):
        order_product = get_object_or_404(Product.objects.select_related("producer"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)
        reviews = ProductReview.objects.filter(
            product=catalog_product,
            moderation_status=ProductReview.ModerationStatus.PUBLISHED,
        ).order_by("-created_at")
        serializer = ProductReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    def post(self, request, product_id: int):
        order_product = get_object_or_404(Product.objects.select_related("producer"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)

        if request.user.role != User.Role.CUSTOMER:
            return Response(
                {"detail": "Only customers can submit reviews."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProductReviewCreateSerializer(
            data=request.data,
            context={
                "request": request,
                "product": catalog_product,
                "order_product": order_product,
                "require_verified_purchase": True,
            },
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        response_status = (
            status.HTTP_202_ACCEPTED
            if review.moderation_status == ProductReview.ModerationStatus.PENDING
            else status.HTTP_201_CREATED
        )
        return Response(ProductReviewSerializer(review).data, status=response_status)


class ProductReviewDetailAPIView(APIView):
    """Allow customers to update their own product review."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, product_id: int, review_id: int):
        order_product = get_object_or_404(Product.objects.select_related("producer"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)
        review = get_object_or_404(
            ProductReview,
            id=review_id,
            product=catalog_product,
            user=request.user,
            moderation_status__in=[
                ProductReview.ModerationStatus.PUBLISHED,
                ProductReview.ModerationStatus.PENDING,
            ],
        )

        if request.user.role != User.Role.CUSTOMER:
            return Response(
                {"detail": "Only customers can edit reviews."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProductReviewUpdateSerializer(
            review,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(ProductReviewSerializer(review).data, status=status.HTTP_200_OK)


class ProductReviewEligibilityAPIView(APIView):
    """Report whether the current user is eligible to review a product."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id: int):
        order_product = get_object_or_404(Product.objects.select_related("producer", "producer__user"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)
        eligibility = get_review_eligibility(
            user=request.user,
            catalog_product=catalog_product,
            order_product=order_product,
            require_verified_purchase=True,
        )
        existing_review = None
        if request.user and request.user.is_authenticated:
            existing_review = (
                ProductReview.objects.filter(
                    product=catalog_product,
                    user=request.user,
                    moderation_status__in=[
                        ProductReview.ModerationStatus.PUBLISHED,
                        ProductReview.ModerationStatus.PENDING,
                    ],
                )
                .order_by("-created_at", "-id")
                .first()
            )

        can_respond = bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.PRODUCER
            and order_product.producer.user_id == request.user.id
        )
        response_reason = (
            "You can respond to customer reviews for your product."
            if can_respond
            else "Only the producer who owns this product can respond to reviews."
        )

        return Response(
            {
                "can_submit": eligibility.can_submit,
                "reason": eligibility.reason,
                "has_verified_purchase": eligibility.has_verified_purchase,
                "has_existing_review": eligibility.has_existing_review,
                "daily_limit_reached": eligibility.daily_limit_reached,
                "is_customer": eligibility.is_customer,
                "is_authenticated": eligibility.is_authenticated,
                "can_respond": can_respond,
                "response_reason": response_reason,
                "existing_review": ProductReviewSerializer(existing_review).data if existing_review else None,
            }
        )


class ProductReviewResponseAPIView(APIView):
    """Allow a producer to respond to a product review."""

    permission_classes = [IsAuthenticated]

    def post(self, request, product_id: int, review_id: int):
        order_product = get_object_or_404(Product.objects.select_related("producer", "producer__user"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)
        review = get_object_or_404(ProductReview, id=review_id, product=catalog_product)

        if request.user.role != User.Role.PRODUCER:
            return Response(
                {"detail": "Only producers can respond to reviews."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if order_product.producer.user_id != request.user.id:
            return Response(
                {"detail": "You can only respond to reviews for your own products."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if review.moderation_status != ProductReview.ModerationStatus.PUBLISHED:
            return Response(
                {"detail": "Producer responses are only available for published reviews."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ProductReviewProducerResponseSerializer(review, data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(ProductReviewSerializer(review).data, status=status.HTTP_200_OK)


class ProductReviewModerationAPIView(APIView):
    """Allow moderators/admins to approve or reject review content."""

    permission_classes = [IsAuthenticated]

    def post(self, request, product_id: int, review_id: int):
        if request.user.role != User.Role.ADMIN:
            return Response(
                {"detail": "Only admin accounts can moderate reviews."},
                status=status.HTTP_403_FORBIDDEN,
            )

        order_product = get_object_or_404(Product.objects.select_related("producer", "producer__user"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)
        review = get_object_or_404(ProductReview, id=review_id, product=catalog_product)

        serializer = ProductReviewModerationSerializer(
            review,
            data=request.data,
            context={"order_product": order_product},
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(ProductReviewSerializer(review).data, status=status.HTTP_200_OK)


class PendingReviewModerationQueueAPIView(APIView):
    """List reviews waiting for moderation review."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMIN:
            return Response(
                {"detail": "Only admin accounts can view the review moderation queue."},
                status=status.HTTP_403_FORBIDDEN,
            )

        reviews = (
            ProductReview.objects.select_related("product", "product__producer", "user")
            .filter(moderation_status=ProductReview.ModerationStatus.PENDING)
            .order_by("created_at")
        )
        serializer = PendingReviewModerationSerializer(reviews, many=True)
        return Response(serializer.data)


class CartAPIView(APIView):
    """Return the current cart or clear/replace it through cart-level actions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_or_create_cart(request.user)
        return Response(build_cart_payload(cart))


class CartItemAddAPIView(APIView):
    """Add a product to the cart while enforcing server-side quantity rules."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get("product_id")
        quantity_raw = request.data.get("quantity")

        if not product_id:
            return Response({"detail": "product_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = _parse_quantity(quantity_raw)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product.objects.select_related("producer"), pk=product_id)
        effective_availability = product.effective_availability()
        if effective_availability == "unavailable":
            detail = "Product is out of season." if product.is_available and product.stock_quantity > 0 else "Product is unavailable."
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
        if quantity > product.stock_quantity:
            return Response(
                {"detail": "Requested quantity exceeds available stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            _enforce_cart_quantity_cap(quantity, user=request.user, stock_quantity=product.stock_quantity)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        cart = get_or_create_cart(request.user)
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, defaults={"quantity": quantity}
        )
        if not created:
            new_qty = cart_item.quantity + quantity
            if new_qty > product.stock_quantity:
                return Response(
                    {"detail": "Requested quantity exceeds available stock."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                _enforce_cart_quantity_cap(new_qty, user=request.user, stock_quantity=product.stock_quantity)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            cart_item.quantity = new_qty.quantize(Decimal("0.01"))
            cart_item.save(update_fields=["quantity", "updated_at"])

        return Response(
            {
                "message": "Item added to cart.",
                "cart": build_cart_payload(cart),
            },
            status=status.HTTP_200_OK,
        )


class CartItemDetailAPIView(APIView):
    """Update or remove one existing cart item."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, item_id: int):
        cart = get_or_create_cart(request.user)
        cart_item = get_object_or_404(
            CartItem.objects.select_related("product"), id=item_id, cart=cart
        )

        try:
            quantity = _parse_quantity(request.data.get("quantity"))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not cart_item.product.is_orderable():
            return Response(
                {"detail": "Product is out of season."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quantity > cart_item.product.stock_quantity:
            return Response(
                {"detail": "Requested quantity exceeds available stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            _enforce_cart_quantity_cap(quantity, user=request.user, stock_quantity=cart_item.product.stock_quantity)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        cart_item.quantity = quantity
        cart_item.save(update_fields=["quantity", "updated_at"])
        return Response({"message": "Cart item updated.", "cart": build_cart_payload(cart)})

    def delete(self, request, item_id: int):
        cart = get_or_create_cart(request.user)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        cart_item.delete()
        return Response({"message": "Cart item removed.", "cart": build_cart_payload(cart)})


class CheckoutPreviewAPIView(APIView):
    """Preview totals, commission, and delivery constraints before checkout."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_or_create_cart(request.user)
        return Response(build_cart_payload(cart))


class CheckoutAPIView(APIView):
    """Convert the current cart into an order and trigger payment flow selection."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        use_stripe_checkout = serializer.validated_data.get("payment_method") == "stripe_checkout"

        if not use_stripe_checkout and getattr(request.user, "role", None) in {"COMMUNITY", "RESTAURANT"}:
            try:
                order = checkout_cart(request.user, serializer.validated_data)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                {
                    "message": "Order placed successfully.",
                    "order": OrderDetailSerializer(order).data,
                },
                status=status.HTTP_201_CREATED,
            )

        if not use_stripe_checkout:
            try:
                order = checkout_cart(request.user, serializer.validated_data)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                {
                    "message": "Order placed successfully.",
                    "order": OrderDetailSerializer(order).data,
                },
                status=status.HTTP_201_CREATED,
            )

        order = None
        try:
            order = checkout_cart_with_stripe_reservation(request.user, serializer.validated_data)
            from apps.payments.services import create_stripe_checkout_session_for_order

            checkout_session = create_stripe_checkout_session_for_order(
                order,
                success_url=serializer.validated_data.get("success_url"),
                cancel_url=serializer.validated_data.get("cancel_url"),
            )
        except ValueError as exc:
            if order is not None:
                try:
                    from apps.payments.services import cancel_stripe_checkout_order

                    cancel_stripe_checkout_order(order)
                except ValueError:
                    pass
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Stripe checkout session created successfully.",
                "order": OrderDetailSerializer(order).data,
                "payment": {
                    "provider": "stripe",
                    "checkout_session_id": checkout_session.session_id,
                    "checkout_url": checkout_session.checkout_url,
                    "publishable_key": checkout_session.publishable_key,
                    "test_mode": checkout_session.test_mode,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class OrderHistoryAPIView(APIView):
    """List previous orders for the signed-in buyer/community/restaurant user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Order.objects.filter(customer=request.user).prefetch_related(
            "sub_orders__producer",
            "sub_orders__status_history__actor",
        )

        producer_id = request.query_params.get("producer_id")
        if producer_id:
            queryset = queryset.filter(sub_orders__producer_id=producer_id)

        producer_name = request.query_params.get("producer_name")
        if producer_name:
            queryset = queryset.filter(sub_orders__producer__business_name__iexact=producer_name.strip())

        from_date_raw = request.query_params.get("from_date")
        if from_date_raw:
            try:
                from_date = date.fromisoformat(from_date_raw)
            except ValueError:
                return Response(
                    {"detail": "from_date must be YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(created_at__date__gte=from_date)

        to_date_raw = request.query_params.get("to_date")
        if to_date_raw:
            try:
                to_date = date.fromisoformat(to_date_raw)
            except ValueError:
                return Response(
                    {"detail": "to_date must be YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(created_at__date__lte=to_date)

        queryset = queryset.distinct()
        serializer = OrderSummarySerializer(queryset, many=True)
        return Response(serializer.data)


class OrderDetailAPIView(APIView):
    """Return the detailed breakdown for one historical order."""

    permission_classes = [IsAuthenticated]

    def get(self, request, order_id: int):
        order = get_object_or_404(
            Order.objects.prefetch_related("sub_orders__producer", "sub_orders__status_history__actor", "items"),
            id=order_id,
            customer=request.user,
        )
        return Response(OrderDetailSerializer(order).data)


class OrderReorderAPIView(APIView):
    """Copy a historical order back into the current cart."""

    permission_classes = [IsAuthenticated]

    def post(self, request, order_id: int):
        order = get_object_or_404(
            Order.objects.prefetch_related("items__product"), id=order_id, customer=request.user
        )
        result = reorder_order_to_cart(request.user, order)
        return Response(result, status=status.HTTP_200_OK)


class OrderReceiptAPIView(APIView):
    """Return a receipt/export-friendly representation of an order."""

    permission_classes = [IsAuthenticated]

    def get(self, request, order_id: int):
        order = get_object_or_404(
            Order.objects.prefetch_related("sub_orders__producer", "items"),
            id=order_id,
            customer=request.user,
        )

        lines = [
            f"Receipt: {order.order_number}",
            f"Date: {order.created_at.isoformat()}",
            f"Status: {order.status}",
            "",
            "Items:",
        ]
        for item in order.items.all():
            lines.append(
                f"- {item.product_name} ({item.producer_name}): {item.quantity} {item.unit} x £{item.unit_price} = £{item.line_total}"
            )

        lines.extend(
            [
                "",
                f"Subtotal: £{order.subtotal_amount}",
                f"Network commission (5%): £{order.commission_amount}",
                f"Total paid: £{order.total_amount}",
                "",
                f"Payment reference: {order.payment_reference[:4]}***{order.payment_reference[-3:] if order.payment_reference else ''}",
                f"Delivery address: {order.delivery_address}",
                f"Delivery postcode: {order.customer_postcode}",
            ]
        )

        response = HttpResponse("\n".join(lines), content_type="text/plain")
        response["Content-Disposition"] = f'attachment; filename="{order.order_number}-receipt.txt"'
        return response


class ProducerSubOrderListAPIView(APIView):
    """List producer-specific sub-orders created from multi-vendor orders."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        producer = get_object_or_404(Producer, user=request.user, is_active=True)
        sub_orders = (
            ProducerSubOrder.objects.filter(producer=producer)
            .select_related("order", "producer")
            .prefetch_related("items", "status_history__actor")
            .order_by("-created_at")
        )
        payload = [_producer_sub_order_payload(sub_order) for sub_order in sub_orders]
        return Response(payload)


class ProducerSubOrderStatusUpdateAPIView(APIView):
    """Advance a producer sub-order through the permitted status transitions."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, sub_order_id: int):
        producer = get_object_or_404(Producer, user=request.user, is_active=True)
        sub_order = get_object_or_404(
            ProducerSubOrder.objects.select_for_update().select_related("order", "producer").prefetch_related("items", "delivery_jobs"),
            id=sub_order_id,
            producer=producer,
        )

        next_status = request.data.get("status")
        valid_choices = {choice for choice, _ in Order.Status.choices}
        if next_status not in valid_choices:
            return Response({"detail": "Invalid status value."}, status=status.HTTP_400_BAD_REQUEST)
        if next_status != sub_order.status:
            previous_status = sub_order.status
            allowed = PRODUCER_SUBORDER_ALLOWED_TRANSITIONS.get(sub_order.status, set())
            if next_status not in allowed:
                return Response(
                    {"detail": f"Invalid status transition from '{sub_order.status}' to '{next_status}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if next_status == Order.Status.READY:
                from apps.delivery.services import dispatch_sub_order_to_stuart

                try:
                    dispatch_sub_order_to_stuart(sub_order)
                except ValueError as exc:
                    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            sub_order.status = next_status
            note = str(request.data.get("note", "") or "").strip()
            if note:
                sub_order.notes = note
            sub_order.save(update_fields=["status", "notes", "updated_at"])
            ProducerSubOrderStatusHistory.objects.create(
                sub_order=sub_order,
                actor=request.user,
                previous_status=previous_status,
                new_status=next_status,
                note=note,
            )
            UserNotification.objects.create(
                user=sub_order.order.customer,
                category="order_status",
                message=f"Order {sub_order.order.order_number} is now {next_status}.",
                metadata={
                    "order_id": sub_order.order_id,
                    "sub_order_id": sub_order.id,
                    "previous_status": previous_status,
                    "new_status": next_status,
                    "note": note,
                },
            )
            if next_status == Order.Status.DELIVERED:
                _deduct_producer_portal_stock_for_delivery(sub_order)
            _sync_parent_order_status(sub_order.order)
            sub_order.refresh_from_db()

        return Response(_producer_sub_order_payload(sub_order), status=status.HTTP_200_OK)
