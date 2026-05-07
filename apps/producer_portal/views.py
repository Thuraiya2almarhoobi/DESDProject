"""
DESD Marketplace documentation.

File role:
    Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

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

from decimal import Decimal, ROUND_CEILING

from django.contrib.auth import get_user_model
from django.db.models import F
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, response, status
from rest_framework.views import APIView

from apps.orders.marketplace_sync import (
    delete_orders_and_catalog_products_for_name,
    delete_orders_and_catalog_products_for_producer_product,
    sync_orders_product_from_producer_product,
)
from apps.orders.models import Producer as OrdersProducer
from apps.orders.models import FavoriteProducer, ProducerNotification, UserNotification

from .models import (
    OrderStatus,
    ProducerOrder,
    ProducerProduct,
    ProducerProductInventoryEvent,
    ProductAvailability,
)
from .serializers import (
    ProducerProductInventoryEventSerializer,
    ProducerOrderSerializer,
    ProducerOrderStatusUpdateSerializer,
    ProducerProductSerializer,
)

User = get_user_model()


class IsProducerUser(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.PRODUCER
        )


def _effective_customer_visible_ids(queryset):
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_effective_customer_visible_ids` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.
    """
    matching_ids = []
    for product in queryset:
        if product.effective_availability in {ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND}:
            matching_ids.append(product.id)
    return matching_ids


def _get_or_create_demo_user(email: str):
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_get_or_create_demo_user` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.
    """
    normalized_email = (email or "producer@example.com").strip().lower()
    existing = User.objects.filter(email__iexact=normalized_email).first()
    if existing:
        return existing

    return User.objects.create_user(
        email=normalized_email,
        password="demo-password",
    )


def _resolve_actor_user(request):
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_resolve_actor_user` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.
    """
    return request.user


def _orders_producer_for_user(user):
    return OrdersProducer.objects.filter(user=user, is_active=True).first()


PRODUCT_HISTORY_FIELDS = [
    "name",
    "category",
    "description",
    "price",
    "unit",
    "availability",
    "season_start_month",
    "season_end_month",
    "stock_quantity",
    "low_stock_threshold",
    "is_organic",
    "organic_certification",
    "allergen_information",
    "no_known_allergens_confirmed",
    "storage_tips",
    "storage_tips_ai_generated",
    "harvest_date",
    "image_url",
    "is_surplus",
    "surplus_discount_percent",
    "surplus_expires_at",
    "surplus_best_before",
    "surplus_note",
]


def _history_value(value):
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _product_snapshot(product: ProducerProduct) -> dict:
    return {field: _history_value(getattr(product, field, None)) for field in PRODUCT_HISTORY_FIELDS}


def _record_inventory_event(product: ProducerProduct, *, actor, event_type: str, previous=None) -> None:
    previous_values = _product_snapshot(previous) if previous is not None else {}
    new_values = _product_snapshot(product)
    # store changed fields so product history can show before and after values
    # the producer history panel reads these snapshots instead of guessing from logs
    changed_fields = [
        field for field in PRODUCT_HISTORY_FIELDS
        if previous is None or previous_values.get(field) != new_values.get(field)
    ]
    ProducerProductInventoryEvent.objects.create(
        product=product,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        event_type=event_type,
        previous_stock_quantity=getattr(previous, "stock_quantity", None),
        new_stock_quantity=product.stock_quantity,
        previous_availability=getattr(previous, "availability", "") or "",
        new_availability=product.availability,
        changed_fields=changed_fields,
        previous_values={field: previous_values.get(field) for field in changed_fields},
        new_values={field: new_values.get(field) for field in changed_fields},
        note=(
            f"{event_type.replace('_', ' ').title()}: "
            f"{', '.join(changed_fields) if changed_fields else 'no field changes'}"
        ),
    )


def _sync_product_notifications(product: ProducerProduct) -> None:
    # inventory alerts are resolved here whenever product state changes
    # this keeps low stock and seasonal reminders tied to the latest producer edit
    orders_producer = _orders_producer_for_user(product.producer)
    if orders_producer is None:
        return

    low_stock_reports = ProducerNotification.objects.filter(
        producer=orders_producer,
        category="low_stock",
        metadata__product_id=product.id,
        resolved_at__isnull=True,
    )
    if 0 < product.stock_quantity <= product.low_stock_threshold:
        if not low_stock_reports.exists():
            ProducerNotification.objects.create(
                producer=orders_producer,
                category="low_stock",
                message=(
                    f"Low Stock Alert: {product.name} - Only {product.stock_quantity} "
                    f"{product.unit} remaining"
                ),
                metadata={
                    "product_id": product.id,
                    "product_name": product.name,
                    "stock_quantity": product.stock_quantity,
                    "threshold": product.low_stock_threshold,
                },
            )
    else:
        low_stock_reports.update(resolved_at=timezone.now())

    seasonal_reports = ProducerNotification.objects.filter(
        producer=orders_producer,
        category="seasonal_reminder",
        metadata__product_id=product.id,
        resolved_at__isnull=True,
    )
    reminder = product.season_reminder_message
    if reminder:
        if not seasonal_reports.exists():
            ProducerNotification.objects.create(
                producer=orders_producer,
                category="seasonal_reminder",
                message=reminder,
                metadata={
                    "product_id": product.id,
                    "product_name": product.name,
                    "season_start_month": product.season_start_month,
                    "season_end_month": product.season_end_month,
                },
            )
    else:
        seasonal_reports.update(resolved_at=timezone.now())


def _notify_favorite_producer_surplus(product: ProducerProduct, *, previous: ProducerProduct | None = None) -> None:
    # surplus notifications are created only when a deal first appears
    # favourite customers should not get duplicate alerts for later stock edits
    if not product.is_surplus:
        return
    if previous is not None and previous.is_surplus:
        return

    orders_producer = _orders_producer_for_user(product.producer)
    if orders_producer is None:
        return

    favorites = FavoriteProducer.objects.select_related("user").filter(producer=orders_producer)
    for favorite in favorites:
        UserNotification.objects.get_or_create(
            user=favorite.user,
            category="surplus_deal",
            metadata={
                "producer_id": orders_producer.id,
                "producer_product_id": product.id,
                "product_name": product.name,
            },
            defaults={
                "message": (
                    f"{orders_producer.business_name} added a surplus deal: "
                    f"{product.name}"
                    + (
                        f" at {product.surplus_discount_percent}% off."
                        if product.surplus_discount_percent
                        else "."
                    )
                )
            },
        )


def _producer_order_stock_units(quantity: Decimal) -> int:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_producer_order_stock_units` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.
    """
    whole_units = quantity.to_integral_value()
    if quantity == whole_units:
        return int(whole_units)
    return int(quantity.to_integral_value(rounding=ROUND_CEILING))


def _deduct_stock_for_producer_order(order: ProducerOrder) -> None:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_deduct_stock_for_producer_order` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.
    """
    for item in order.items.select_related("product"):
        quantity_to_deduct = _producer_order_stock_units(item.quantity)
        if quantity_to_deduct <= 0:
            continue

        producer_product = None
        if item.product_id:
            producer_product = ProducerProduct.objects.select_for_update().filter(pk=item.product_id).first()
        if producer_product is None:
            producer_product = (
                ProducerProduct.objects.select_for_update()
                .filter(producer=order.producer, name=item.product_name)
                .order_by("-updated_at", "-id")
                .first()
            )
        if producer_product is None:
            continue

        producer_product.stock_quantity = max(0, producer_product.stock_quantity - quantity_to_deduct)
        producer_product.save(update_fields=["stock_quantity", "updated_at"])
        sync_orders_product_from_producer_product(producer_product)

class PublicMarketplaceProductsAPIView(generics.ListAPIView):
    """
    Documents the `PublicMarketplaceProductsAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = (
            ProducerProduct.objects.filter(
                availability__in=[ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND],
                stock_quantity__gt=0,
            )
            .select_related("producer")
            .order_by("-created_at")
        )
        return queryset.filter(id__in=_effective_customer_visible_ids(queryset))


class PublicMarketplaceProductDetailAPIView(generics.RetrieveAPIView):
    """
    Documents the `PublicMarketplaceProductDetailAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = (
            ProducerProduct.objects.filter(
                availability__in=[ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND],
                stock_quantity__gt=0,
            )
            .select_related("producer")
        )
        return queryset.filter(id__in=_effective_customer_visible_ids(queryset))


class ProducerProductListCreateAPIView(generics.ListCreateAPIView):
    """
    Documents the `ProducerProductListCreateAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsProducerUser]

    def get_queryset(self):
        actor = _resolve_actor_user(self.request)
        queryset = ProducerProduct.objects.filter(producer=actor).order_by("-created_at")
        low_stock = self.request.query_params.get("low_stock")
        if low_stock in {"1", "true", "yes"}:
            threshold_param = self.request.query_params.get("threshold")
            if threshold_param is not None:
                try:
                    threshold = int(threshold_param)
                except (TypeError, ValueError):
                    threshold = 10
                queryset = queryset.filter(stock_quantity__gt=0, stock_quantity__lte=threshold)
            else:
                queryset = queryset.filter(stock_quantity__gt=0, stock_quantity__lte=F("low_stock_threshold"))
        return queryset

    def perform_create(self, serializer):
        # create writes inventory history before syncing the customer catalog
        # this proves tc-11 product history exists from the first product version
        product = serializer.save(producer=_resolve_actor_user(self.request))
        _record_inventory_event(product, actor=self.request.user, event_type="created")
        sync_orders_product_from_producer_product(product)
        _sync_product_notifications(product)
        _notify_favorite_producer_surplus(product)


class ProducerProductDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Documents the `ProducerProductDetailAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsProducerUser]

    def get_queryset(self):
        return ProducerProduct.objects.filter(producer=_resolve_actor_user(self.request))

    def perform_update(self, serializer):
        # update snapshots every editable field before syncing marketplace mirrors
        # this preserves the producer facing product update history view
        old_name = serializer.instance.name
        previous = ProducerProduct.objects.get(pk=serializer.instance.pk)
        product = serializer.save()
        _record_inventory_event(product, actor=self.request.user, event_type="updated", previous=previous)
        if old_name != product.name:
            delete_orders_and_catalog_products_for_name(
                producer_user=product.producer,
                product_name=old_name,
            )
        sync_orders_product_from_producer_product(product)
        _sync_product_notifications(product)
        _notify_favorite_producer_surplus(product, previous=previous)

    def perform_destroy(self, instance):
        delete_orders_and_catalog_products_for_producer_product(instance)
        instance.delete()


class ProducerProductHistoryAPIView(generics.ListAPIView):
    serializer_class = ProducerProductInventoryEventSerializer
    permission_classes = [permissions.IsAuthenticated, IsProducerUser]

    def get_queryset(self):
        # product history is producer scoped so one farm cannot inspect another farm
        # the rows are already ordered newest first by the inventory event model
        product = get_object_or_404(
            ProducerProduct,
            pk=self.kwargs["pk"],
            producer=_resolve_actor_user(self.request),
        )
        return product.inventory_events.select_related("actor", "product").order_by("-created_at", "-id")


class ProducerSurplusDealAPIView(APIView):
    """
    Documents the `ProducerSurplusDealAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    permission_classes = [permissions.IsAuthenticated, IsProducerUser]

    def patch(self, request, pk: int):
        product = get_object_or_404(ProducerProduct, pk=pk, producer=_resolve_actor_user(request))
        serializer = ProducerProductSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        previous = ProducerProduct.objects.get(pk=product.pk)
        updated = serializer.save()
        _record_inventory_event(updated, actor=request.user, event_type="surplus_updated", previous=previous)
        sync_orders_product_from_producer_product(updated)
        _sync_product_notifications(updated)
        _notify_favorite_producer_surplus(updated, previous=previous)
        return response.Response(serializer.data)


class ProducerLowStockAlertsAPIView(APIView):
    """
    Documents the `ProducerLowStockAlertsAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    permission_classes = [permissions.IsAuthenticated, IsProducerUser]

    def get(self, request):
        threshold_param = request.query_params.get("threshold")
        threshold = None
        products = ProducerProduct.objects.filter(producer=_resolve_actor_user(request))
        if threshold_param is not None:
            try:
                threshold = int(threshold_param)
            except (TypeError, ValueError):
                threshold = 10
            products = products.filter(stock_quantity__gt=0, stock_quantity__lte=threshold)
        else:
            products = products.filter(stock_quantity__gt=0, stock_quantity__lte=F("low_stock_threshold"))
        products = products.order_by("stock_quantity", "name")
        for product in products:
            _sync_product_notifications(product)
        serializer = ProducerProductSerializer(products, many=True)
        return response.Response({"threshold": threshold, "count": len(serializer.data), "results": serializer.data})


class ProducerOrdersInboxAPIView(generics.ListAPIView):
    """
    Documents the `ProducerOrdersInboxAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProducerOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = (
            ProducerOrder.objects.filter(producer=self.request.user)
            .prefetch_related("items", "items__product")
            .order_by("delivery_date", "id")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


class ProducerOrderDetailAPIView(generics.RetrieveAPIView):
    """
    Documents the `ProducerOrderDetailAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProducerOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProducerOrder.objects.filter(producer=self.request.user).prefetch_related("items", "items__product")


class ProducerOrderStatusUpdateAPIView(generics.UpdateAPIView):
    """
    Documents the `ProducerOrderStatusUpdateAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProducerOrderStatusUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["patch"]

    def get_queryset(self):
        return ProducerOrder.objects.filter(producer=self.request.user).prefetch_related("items", "items__product")

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        previous_status = instance.status
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        if previous_status != OrderStatus.DELIVERED and updated.status == OrderStatus.DELIVERED:
            _deduct_stock_for_producer_order(updated)
            updated.refresh_from_db()
        payload = ProducerOrderSerializer(updated).data
        return response.Response(payload, status=status.HTTP_200_OK)
