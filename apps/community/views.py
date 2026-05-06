"""
DESD Marketplace documentation.

File role:
    Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

Domain context:
    Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCommunity
from apps.orders.models import Order
from apps.orders.serializers import CheckoutRequestSerializer, OrderDetailSerializer
from apps.orders.services import checkout_cart, checkout_cart_with_stripe_reservation


class CommunityBulkCheckoutAPIView(APIView):
    """
    Documents the `CommunityBulkCheckoutAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the community domain: community feedback, review policy, and urls/views used by shared buyer-community workflows.
    can be changed without spreading the same responsibility across unrelated files.
    """
    permission_classes = [IsAuthenticated, IsCommunity]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        use_stripe_checkout = serializer.validated_data.get("payment_method") == "stripe_checkout"
        order = None
        try:
            if use_stripe_checkout:
                order = checkout_cart_with_stripe_reservation(request.user, serializer.validated_data)
                from apps.payments.services import create_stripe_checkout_session_for_order

                checkout_session = create_stripe_checkout_session_for_order(
                    order,
                    success_url=serializer.validated_data.get("success_url"),
                    cancel_url=serializer.validated_data.get("cancel_url"),
                )
            else:
                order = checkout_cart(request.user, serializer.validated_data)
        except ValueError as exc:
            if order is not None and use_stripe_checkout:
                try:
                    from apps.payments.services import cancel_stripe_checkout_order

                    cancel_stripe_checkout_order(order)
                except ValueError:
                    pass
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = OrderDetailSerializer(order).data
        payload["producer_contacts"] = [
            {
                "producer_id": sub_order.producer.id,
                "producer_name": sub_order.producer.business_name,
                "phone": sub_order.producer.phone,
                "email": sub_order.producer.contact_email,
            }
            for sub_order in order.sub_orders.select_related("producer").all()
        ]
        response_payload = {
            "message": "Bulk order placed successfully." if not use_stripe_checkout else "Stripe checkout session created successfully.",
            "order": payload,
        }
        if use_stripe_checkout:
            response_payload["payment"] = {
                "provider": "stripe",
                "checkout_session_id": checkout_session.session_id,
                "checkout_url": checkout_session.checkout_url,
                "publishable_key": checkout_session.publishable_key,
                "test_mode": checkout_session.test_mode,
            }
        return Response(response_payload, status=status.HTTP_201_CREATED)


class CommunityOrderConfirmationAPIView(APIView):
    """
    Documents the `CommunityOrderConfirmationAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the community domain: community feedback, review policy, and urls/views used by shared buyer-community workflows.
    can be changed without spreading the same responsibility across unrelated files.
    """
    permission_classes = [IsAuthenticated, IsCommunity]

    def get(self, request, order_id: int):
        order = get_object_or_404(
            Order.objects.prefetch_related("sub_orders__producer", "items"),
            id=order_id,
            customer=request.user,
        )
        serializer = OrderDetailSerializer(order)
        producer_contacts = [
            {
                "producer_id": sub_order.producer.id,
                "producer_name": sub_order.producer.business_name,
                "phone": sub_order.producer.phone,
                "email": sub_order.producer.contact_email,
                "delivery_date": str(sub_order.delivery_date),
                "subtotal_amount": str(sub_order.subtotal_amount),
                "payout_amount": str(sub_order.payout_amount),
            }
            for sub_order in order.sub_orders.select_related("producer").all()
        ]
        return Response(
            {
                "order": serializer.data,
                "producer_contacts": producer_contacts,
            }
        )
