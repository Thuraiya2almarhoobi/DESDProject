from decimal import Decimal, InvalidOperation

from django.db.models import Q
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.community.models import ProductReview
from .models import Category, Product
from .serializers import CategorySerializer, ProductReviewSerializer, ProductSerializer

TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def _parse_boolean(value: str | None) -> bool | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    return None


def _parse_decimal(value: str | None) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(value.strip())
    except (InvalidOperation, ValueError):
        return None


def _filter_queryset_by_effective_availability(queryset, allowed_availabilities: set[str], require_stock: bool = False):
    matching_ids = []
    for product in queryset:
        if require_stock and product.stock <= 0:
            continue
        if product.effective_availability() in allowed_availabilities:
            matching_ids.append(product.id)
    return queryset.filter(id__in=matching_ids)


class CategoryListAPIView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
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
            queryset = queryset.filter(
                Q(name__icontains=search_query)
                | Q(description__icontains=search_query)
                | Q(producer__name__icontains=search_query)
                | Q(category__name__icontains=search_query)
                | Q(allergens__icontains=search_query)
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

    @action(detail=True, methods=["get"], url_path="reviews")
    def reviews(self, request, pk=None):
        product = self.get_object()
        reviews = ProductReview.objects.filter(product=product).order_by("-created_at")
        serializer = ProductReviewSerializer(reviews, many=True)
        return Response(serializer.data)
