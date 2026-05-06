"""
DESD Marketplace documentation.

File role:
    Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

Domain context:
    Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from decimal import Decimal, InvalidOperation

from django.db.models import Q
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User
from apps.community.models import ProductReview
from bristol_marketplace.search_utils import filter_queryset_with_fuzzy_fallback
from .models import Category, Product
from .serializers import (
    CategorySerializer,
    ProductReviewCreateSerializer,
    ProductReviewSerializer,
    ProductSerializer,
)

TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def _parse_boolean(value: str | None) -> bool | None:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_parse_boolean` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.
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
    context is: Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.
    """
    if value is None:
        return None
    try:
        return Decimal(value.strip())
    except (InvalidOperation, ValueError):
        return None


def _filter_queryset_by_effective_availability(queryset, allowed_availabilities: set[str], require_stock: bool = False):
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_filter_queryset_by_effective_availability` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.
    """
    allowed_values = {str(value) for value in allowed_availabilities}
    matching_ids = set()
    if Product.Availability.YEAR_ROUND in allowed_values:
        year_round_queryset = queryset.filter(availability=Product.Availability.YEAR_ROUND)
        if require_stock:
            year_round_queryset = year_round_queryset.filter(stock__gt=0)
        matching_ids.update(year_round_queryset.values_list("id", flat=True))

    for product in queryset.exclude(availability=Product.Availability.YEAR_ROUND):
        if require_stock and product.stock <= 0:
            continue
        if product.effective_availability() in allowed_values:
            matching_ids.add(product.id)
    return queryset.filter(id__in=matching_ids)


class CategoryListAPIView(generics.ListAPIView):
    """
    Documents the `CategoryListAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Documents the `ProductViewSet` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    serializer_class = ProductSerializer
    queryset = Product.objects.select_related("category", "producer")

    def get_queryset(self):
        queryset = self.queryset

        category_param = self.request.query_params.get("category")
        if category_param:
            category_tokens = [token.strip() for token in category_param.split(",") if token.strip()]
            category_filter = Q()
            for token in category_tokens:
                if token.isdigit():
                    category_filter |= Q(category_id=int(token))
                else:
                    category_filter |= Q(category__slug__iexact=token) | Q(category__name__iexact=token)
            if category_filter:
                queryset = queryset.filter(category_filter)

        search_query = self.request.query_params.get("search")
        if search_query:
            queryset = filter_queryset_with_fuzzy_fallback(
                queryset,
                search_query=search_query,
                field_names=("name", "description", "producer__name", "category__name", "allergens"),
                text_getter=lambda product: " ".join(
                    [
                        product.name or "",
                        product.description or "",
                        product.producer.name if product.producer_id else "",
                        product.category.name if product.category_id else "",
                        " ".join(product.allergens or []) if isinstance(product.allergens, list) else str(product.allergens or ""),
                    ]
                ),
            )

        organic_param = _parse_boolean(self.request.query_params.get("organic"))
        if organic_param is not None:
            queryset = queryset.filter(is_organic=organic_param)

        min_price = _parse_decimal(self.request.query_params.get("min_price"))
        if min_price is not None:
            queryset = queryset.filter(price__gte=min_price)

        max_price = _parse_decimal(self.request.query_params.get("max_price"))
        if max_price is not None:
            queryset = queryset.filter(price__lte=max_price)

        in_stock_param = _parse_boolean(self.request.query_params.get("in_stock"))
        if in_stock_param:
            queryset = _filter_queryset_by_effective_availability(
                queryset,
                allowed_availabilities={Product.Availability.IN_SEASON, Product.Availability.YEAR_ROUND},
                require_stock=True,
            )

        availability = self.request.query_params.get("availability")
        availability_values = {choice for choice, _ in Product.Availability.choices}
        if availability in availability_values:
            queryset = _filter_queryset_by_effective_availability(
                queryset,
                allowed_availabilities={availability},
            )

        return queryset.distinct().order_by("name")

    @action(detail=True, methods=["get", "post"], url_path="reviews")
    def reviews(self, request, pk=None):
        product = self.get_object()
        if request.method.lower() == "get":
            reviews = ProductReview.objects.filter(
                product=product,
                moderation_status=ProductReview.ModerationStatus.PUBLISHED,
            ).order_by("-created_at")
            serializer = ProductReviewSerializer(reviews, many=True)
            return Response(serializer.data)

        if not request.user or not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if request.user.role != User.Role.CUSTOMER:
            return Response(
                {"detail": "Only customers can submit reviews."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProductReviewCreateSerializer(
            data=request.data,
            context={
                "request": request,
                "product": product,
                "require_verified_purchase": True,
            },
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        response_serializer = ProductReviewSerializer(review)
        response_status = (
            status.HTTP_202_ACCEPTED
            if review.moderation_status == ProductReview.ModerationStatus.PENDING
            else status.HTTP_201_CREATED
        )
        return Response(response_serializer.data, status=response_status)
