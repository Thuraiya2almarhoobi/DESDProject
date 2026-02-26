from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import generics, permissions, response, status
from rest_framework.views import APIView

from .models import ProducerOrder, ProducerProduct, ProductAvailability
from .serializers import (
    ProducerOrderSerializer,
    ProducerOrderStatusUpdateSerializer,
    ProducerProductSerializer,
)

User = get_user_model()


def _get_or_create_demo_user(email: str):
    normalized_email = (email or "producer@example.com").strip().lower()
    existing = User.objects.filter(email__iexact=normalized_email).first()
    if existing:
        return existing

    local_part = normalized_email.split("@")[0] or "producer"
    base_username = slugify(local_part)[:20] or "producer"
    username = base_username
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base_username}{suffix}"

    return User.objects.create_user(
        username=username,
        email=normalized_email,
        password="demo-password",
    )


def _resolve_actor_user(request):
    if request.user and request.user.is_authenticated:
        return request.user
    demo_email = request.headers.get("X-Demo-User") or request.query_params.get("demo_user") or "producer@example.com"
    return _get_or_create_demo_user(demo_email)


class PublicMarketplaceProductsAPIView(generics.ListAPIView):
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = ProducerProduct.objects.filter(
            availability__in=[ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND],
            stock_quantity__gt=0,
        ).select_related("producer")
        return queryset.order_by("-created_at")


class PublicMarketplaceProductDetailAPIView(generics.RetrieveAPIView):
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ProducerProduct.objects.filter(
            availability__in=[ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND],
            stock_quantity__gt=0,
        ).select_related("producer")


class ProducerProductListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        actor = _resolve_actor_user(self.request)
        queryset = ProducerProduct.objects.filter(producer=actor).order_by("-created_at")
        low_stock = self.request.query_params.get("low_stock")
        if low_stock in {"1", "true", "yes"}:
            threshold = int(self.request.query_params.get("threshold", 10))
            queryset = queryset.filter(stock_quantity__lte=threshold)
        return queryset

    def perform_create(self, serializer):
        serializer.save(producer=_resolve_actor_user(self.request))


class ProducerProductDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProducerProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ProducerProduct.objects.filter(producer=_resolve_actor_user(self.request))


class ProducerSurplusDealAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def patch(self, request, pk: int):
        product = get_object_or_404(ProducerProduct, pk=pk, producer=_resolve_actor_user(request))
        serializer = ProducerProductSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
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
