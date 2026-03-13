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
from apps.community.models import ProductReview

from .marketplace_sync import get_or_create_catalog_product_mirror
from .models import CartItem, CustomerProfile, Order, Producer, ProducerSubOrder, Product
from .serializers import (
    CheckoutRequestSerializer,
    CustomerProfileSerializer,
    MarketplaceProductSerializer,
    OrderDetailSerializer,
    OrderSummarySerializer,
    ProducerSerializer,
    ProductSerializer,
)
from .services import (
    build_cart_payload,
    checkout_cart,
    checkout_cart_with_stripe_reservation,
    get_or_create_cart,
    reorder_order_to_cart,
)

TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def _parse_quantity(value) -> Decimal:
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValueError("Quantity must be numeric.")
    if quantity <= Decimal("0"):
        raise ValueError("Quantity must be greater than zero.")
    return quantity.quantize(Decimal("0.01"))


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


PRODUCER_SUBORDER_ALLOWED_TRANSITIONS = {
    Order.Status.PENDING: {Order.Status.CONFIRMED, Order.Status.CANCELLED},
    Order.Status.CONFIRMED: {Order.Status.READY, Order.Status.CANCELLED},
    Order.Status.READY: {Order.Status.DELIVERED, Order.Status.CANCELLED},
    Order.Status.DELIVERED: set(),
    Order.Status.CANCELLED: set(),
}


def _customer_name_for_order(order: Order) -> str:
    profile = getattr(order.customer, "orders_customer_profile", None)
    if profile and profile.full_name:
        return profile.full_name
    local_part = (order.customer.email or "customer").split("@")[0]
    if not local_part:
        return "Customer"
    return " ".join(part.capitalize() for part in local_part.replace(".", " ").replace("_", " ").split())


def _allowed_next_statuses(current_status: str) -> list[str]:
    allowed = sorted((str(value) for value in PRODUCER_SUBORDER_ALLOWED_TRANSITIONS.get(current_status, set())))
    return [str(current_status), *allowed]


def _sync_parent_order_status(order: Order) -> None:
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
    whole_units = quantity.to_integral_value()
    if quantity == whole_units:
        return int(whole_units)
    # Producer portal inventory stores whole-number stock counts, so round up
    # fractional delivered quantities rather than leaving stock overstated.
    return int(quantity.to_integral_value(rounding=ROUND_CEILING))


def _deduct_producer_portal_stock_for_delivery(sub_order: ProducerSubOrder) -> None:
    payment_record = getattr(sub_order.order, "payment", None)
    if payment_record and bool((payment_record.raw_payload or {}).get("stock_reserved")):
        return

    producer_user = sub_order.producer.user
    if producer_user is None:
        return

    from apps.producer_portal.models import ProducerProduct

    for item in sub_order.items.all():
        quantity_to_deduct = _producer_portal_stock_units(item.quantity)
        if quantity_to_deduct <= 0:
            continue

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

        producer_product.stock_quantity = max(0, producer_product.stock_quantity - quantity_to_deduct)
        producer_product.save(update_fields=["stock_quantity", "updated_at"])


def _producer_sub_order_payload(sub_order: ProducerSubOrder) -> dict:
    order = sub_order.order
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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Producer.objects.filter(is_active=True)
        return Response(ProducerSerializer(queryset, many=True).data)

    def post(self, request):
        serializer = ProducerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producer = serializer.save()
        return Response(ProducerSerializer(producer).data, status=status.HTTP_201_CREATED)


class ProductListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Product.objects.select_related("producer", "producer__user").all()
        producer_id = request.query_params.get("producer_id")
        if producer_id:
            queryset = queryset.filter(producer_id=producer_id)

        search_query = request.query_params.get("search")
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query)
                | Q(description__icontains=search_query)
                | Q(producer__business_name__icontains=search_query)
                | Q(category__icontains=search_query)
                | Q(allergen_info__icontains=search_query)
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
            if organic_param:
                queryset = queryset.filter(Q(name__icontains="organic") | Q(description__icontains="organic"))
            else:
                queryset = queryset.exclude(Q(name__icontains="organic") | Q(description__icontains="organic"))

        min_price = _parse_decimal(request.query_params.get("min_price"))
        if min_price is not None:
            queryset = queryset.filter(price__gte=min_price)

        max_price = _parse_decimal(request.query_params.get("max_price"))
        if max_price is not None:
            queryset = queryset.filter(price__lte=max_price)

        if request.query_params.get("available") == "true":
            queryset = queryset.filter(is_available=True, stock_quantity__gt=0)
        serializer = MarketplaceProductSerializer(queryset.order_by("name"), many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class ProductDetailAPIView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MarketplaceProductSerializer

    def get_queryset(self):
        return Product.objects.select_related("producer", "producer__user").all().order_by("name")


class ProductReviewsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id: int):
        order_product = get_object_or_404(Product.objects.select_related("producer"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)
        reviews = ProductReview.objects.filter(product=catalog_product).order_by("-created_at")
        serializer = ProductReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    def post(self, request, product_id: int):
        order_product = get_object_or_404(Product.objects.select_related("producer"), id=product_id)
        catalog_product = get_or_create_catalog_product_mirror(order_product)

        if request.user.role != "CUSTOMER":
            return Response(
                {"detail": "Only customers can submit reviews."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProductReviewCreateSerializer(
            data=request.data,
            context={"request": request, "product": catalog_product},
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(ProductReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class CartAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_or_create_cart(request.user)
        return Response(build_cart_payload(cart))


class CartItemAddAPIView(APIView):
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
        if not product.is_available or product.stock_quantity <= 0:
            return Response({"detail": "Product is unavailable."}, status=status.HTTP_400_BAD_REQUEST)
        if quantity > product.stock_quantity:
            return Response(
                {"detail": "Requested quantity exceeds available stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        if quantity > cart_item.product.stock_quantity:
            return Response(
                {"detail": "Requested quantity exceeds available stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart_item.quantity = quantity
        cart_item.save(update_fields=["quantity", "updated_at"])
        return Response({"message": "Cart item updated.", "cart": build_cart_payload(cart)})

    def delete(self, request, item_id: int):
        cart = get_or_create_cart(request.user)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        cart_item.delete()
        return Response({"message": "Cart item removed.", "cart": build_cart_payload(cart)})


class CheckoutPreviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_or_create_cart(request.user)
        return Response(build_cart_payload(cart))


class CheckoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if getattr(request.user, "role", None) in {"COMMUNITY", "RESTAURANT"}:
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
            from apps.payments.services import cancel_stripe_checkout_order, create_stripe_checkout_session_for_order

            checkout_session = create_stripe_checkout_session_for_order(order)
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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Order.objects.filter(customer=request.user).prefetch_related("sub_orders__producer")

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
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id: int):
        order = get_object_or_404(
            Order.objects.prefetch_related("sub_orders__producer", "items"),
            id=order_id,
            customer=request.user,
        )
        return Response(OrderDetailSerializer(order).data)


class OrderReorderAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id: int):
        order = get_object_or_404(
            Order.objects.prefetch_related("items__product"), id=order_id, customer=request.user
        )
        result = reorder_order_to_cart(request.user, order)
        return Response(result, status=status.HTTP_200_OK)


class OrderReceiptAPIView(APIView):
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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        producer = get_object_or_404(Producer, user=request.user, is_active=True)
        sub_orders = (
            ProducerSubOrder.objects.filter(producer=producer)
            .select_related("order", "producer")
            .prefetch_related("items")
            .order_by("-created_at")
        )
        payload = [_producer_sub_order_payload(sub_order) for sub_order in sub_orders]
        return Response(payload)


class ProducerSubOrderStatusUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, sub_order_id: int):
        producer = get_object_or_404(Producer, user=request.user, is_active=True)
        sub_order = get_object_or_404(
            ProducerSubOrder.objects.select_for_update().select_related("order", "producer").prefetch_related("items"),
            id=sub_order_id,
            producer=producer,
        )

        next_status = request.data.get("status")
        valid_choices = {choice for choice, _ in Order.Status.choices}
        if next_status not in valid_choices:
            return Response({"detail": "Invalid status value."}, status=status.HTTP_400_BAD_REQUEST)
        if next_status != sub_order.status:
            allowed = PRODUCER_SUBORDER_ALLOWED_TRANSITIONS.get(sub_order.status, set())
            if next_status not in allowed:
                return Response(
                    {"detail": f"Invalid status transition from '{sub_order.status}' to '{next_status}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sub_order.status = next_status
            sub_order.save(update_fields=["status", "updated_at"])
            if next_status == Order.Status.DELIVERED:
                _deduct_producer_portal_stock_for_delivery(sub_order)
            _sync_parent_order_status(sub_order.order)
            sub_order.refresh_from_db()

        return Response(_producer_sub_order_payload(sub_order), status=status.HTTP_200_OK)
