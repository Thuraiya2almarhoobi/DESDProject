from decimal import Decimal, InvalidOperation

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CartItem, CustomerProfile, Order, Producer, ProducerSubOrder, Product
from .serializers import (
    CheckoutRequestSerializer,
    CustomerProfileSerializer,
    OrderDetailSerializer,
    OrderSummarySerializer,
    ProducerSerializer,
    ProductSerializer,
)
from .services import build_cart_payload, checkout_cart, get_or_create_cart, reorder_order_to_cart


def _parse_quantity(value) -> Decimal:
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValueError("Quantity must be numeric.")
    if quantity <= Decimal("0"):
        raise ValueError("Quantity must be greater than zero.")
    return quantity.quantize(Decimal("0.01"))


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
        "lead_time_hours": sub_order.producer.lead_time_hours,
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
        queryset = Product.objects.select_related("producer").all()
        producer_id = request.query_params.get("producer_id")
        if producer_id:
            queryset = queryset.filter(producer_id=producer_id)
        if request.query_params.get("available") == "true":
            queryset = queryset.filter(is_available=True, stock_quantity__gt=0)
        serializer = ProductSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


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

        cart = get_or_create_cart(request.user)
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, defaults={"quantity": quantity}
        )
        if not created:
            new_qty = cart_item.quantity + quantity
            if new_qty > product.stock_quantity:
                new_qty = product.stock_quantity
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


class OrderHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Order.objects.filter(customer=request.user).prefetch_related("sub_orders__producer")
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

    def patch(self, request, sub_order_id: int):
        producer = get_object_or_404(Producer, user=request.user, is_active=True)
        sub_order = get_object_or_404(
            ProducerSubOrder.objects.select_related("order", "producer").prefetch_related("items"),
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
            _sync_parent_order_status(sub_order.order)
            sub_order.refresh_from_db()

        return Response(_producer_sub_order_payload(sub_order), status=status.HTTP_200_OK)
