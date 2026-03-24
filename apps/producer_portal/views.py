from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, response, status
from rest_framework.views import APIView

from .models import ProducerOrder, ProducerProduct, ProductAvailability
from .serializers import (
    ProducerOrderSerializer,
    ProducerOrderStatusUpdateSerializer,
    ProducerProductSerializer,
)

User = get_user_model()


def _effective_customer_visible_ids(queryset):
    matching_ids = []
    for product in queryset:
        if product.effective_availability in {ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND}:
            matching_ids.append(product.id)
    return matching_ids


def _get_or_create_demo_user(email: str):
    normalized_email = (email or "producer@example.com").strip().lower()
    existing = User.objects.filter(email__iexact=normalized_email).first()
    if existing:
        return existing

    return User.objects.create_user(
        email=normalized_email,
        password="demo-password",
    )


def _resolve_actor_user(request):
    if request.user and request.user.is_authenticated:
        return request.user
    demo_email = request.headers.get("X-Demo-User") or request.query_params.get("demo_user") or "producer@example.com"
    return _get_or_create_demo_user(demo_email)


def _default_business_name_for_user(user) -> str:
    profile = getattr(user, "producer_profile", None)
    if profile and profile.business_name:
        return profile.business_name

    local_part = (user.email or "producer").split("@")[0]
    words = [token for token in local_part.replace(".", " ").replace("_", " ").replace("-", " ").split() if token]
    if words:
        return " ".join(word.capitalize() for word in words) + " Farm"
    return f"Producer {user.pk} Farm"


def _sync_orders_product(producer_product: ProducerProduct) -> None:
    # Keep producer-portal products visible in customer flows backed by apps.orders.
    from apps.orders.models import Producer as OrdersProducer
    from apps.orders.models import Product as OrdersProduct

    owner = producer_product.producer
    orders_producer = OrdersProducer.objects.filter(user=owner).first()
    if orders_producer is None:
        base_name = _default_business_name_for_user(owner)
        business_name = base_name
        suffix = 2
        while OrdersProducer.objects.filter(business_name=business_name).exclude(user=owner).exists():
            business_name = f"{base_name} {suffix}"
            suffix += 1

        orders_producer = OrdersProducer.objects.create(
            user=owner,
            business_name=business_name,
            contact_email=owner.email or "",
            postcode=getattr(getattr(owner, "producer_profile", None), "address", None).postcode
            if getattr(getattr(owner, "producer_profile", None), "address", None)
            else "BS1 1AA",
            lead_time_hours=48,
            is_active=True,
        )
    else:
        updated = False
        if not orders_producer.contact_email and owner.email:
            orders_producer.contact_email = owner.email
            updated = True
        if not orders_producer.postcode:
            orders_producer.postcode = "BS1 1AA"
            updated = True
        if updated:
            orders_producer.save(update_fields=["contact_email", "postcode", "updated_at"])

    is_available = (
        producer_product.availability in {ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND}
        and producer_product.stock_quantity > 0
    )
    OrdersProduct.objects.update_or_create(
        producer=orders_producer,
        name=producer_product.name,
        defaults={
            "category": producer_product.category,
            "description": producer_product.description,
            "unit": producer_product.unit,
            "price": producer_product.price,
            "stock_quantity": producer_product.stock_quantity,
            "is_available": is_available,
            "in_season": producer_product.availability == ProductAvailability.IN_SEASON,
            "harvest_date": producer_product.harvest_date,
            "allergen_info": producer_product.allergen_information,
        },
    )


def _delete_synced_orders_product_by_name(*, producer_user, product_name: str) -> None:
    from apps.orders.models import Producer as OrdersProducer
    from apps.orders.models import Product as OrdersProduct

    orders_producer = OrdersProducer.objects.filter(user=producer_user).first()
    if orders_producer is None:
        return
    OrdersProduct.objects.filter(producer=orders_producer, name=product_name).delete()


def _delete_synced_orders_product(producer_product: ProducerProduct) -> None:
    _delete_synced_orders_product_by_name(
        producer_user=producer_product.producer,
        product_name=producer_product.name,
    )


class PublicMarketplaceProductsAPIView(generics.ListAPIView):
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
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        actor = _resolve_actor_user(self.request)
        queryset = ProducerProduct.objects.filter(producer=actor).order_by("-created_at")
        low_stock = self.request.query_params.get("low_stock")
        if low_stock in {"1", "true", "yes"}:
            try:
                threshold = int(self.request.query_params.get("threshold", 10))
            except (TypeError, ValueError):
                threshold = 10
            queryset = queryset.filter(stock_quantity__lte=threshold)
        return queryset

    def perform_create(self, serializer):
        product = serializer.save(producer=_resolve_actor_user(self.request))
        _sync_orders_product(product)


class ProducerProductDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ProducerProduct.objects.filter(producer=_resolve_actor_user(self.request))

    def perform_update(self, serializer):
        old_name = serializer.instance.name
        product = serializer.save()
        if old_name != product.name:
            _delete_synced_orders_product_by_name(
                producer_user=product.producer,
                product_name=old_name,
            )
        _sync_orders_product(product)

    def perform_destroy(self, instance):
        _delete_synced_orders_product(instance)
        instance.delete()


class ProducerSurplusDealAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def patch(self, request, pk: int):
        product = get_object_or_404(ProducerProduct, pk=pk, producer=_resolve_actor_user(request))
        serializer = ProducerProductSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        _sync_orders_product(updated)
        return response.Response(serializer.data)


class ProducerLowStockAlertsAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        threshold = int(request.query_params.get("threshold", 10))
        products = ProducerProduct.objects.filter(
            producer=_resolve_actor_user(request),
            stock_quantity__lte=threshold,
        ).order_by("stock_quantity", "name")
        serializer = ProducerProductSerializer(products, many=True)
        return response.Response({"threshold": threshold, "count": len(serializer.data), "results": serializer.data})


class ProducerOrdersInboxAPIView(generics.ListAPIView):
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
    serializer_class = ProducerOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProducerOrder.objects.filter(producer=self.request.user).prefetch_related("items", "items__product")


class ProducerOrderStatusUpdateAPIView(generics.UpdateAPIView):
    serializer_class = ProducerOrderStatusUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["patch"]

    def get_queryset(self):
        return ProducerOrder.objects.filter(producer=self.request.user)

    def patch(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        payload = ProducerOrderSerializer(instance).data
        return response.Response(payload, status=status.HTTP_200_OK)
