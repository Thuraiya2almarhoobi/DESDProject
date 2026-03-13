from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCommunity
from apps.orders.models import Order
from apps.orders.serializers import CheckoutRequestSerializer, OrderDetailSerializer
from apps.orders.services import checkout_cart


class CommunityBulkCheckoutAPIView(APIView):
    permission_classes = [IsAuthenticated, IsCommunity]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order = checkout_cart(request.user, serializer.validated_data)
        except ValueError as exc:
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
        return Response(
            {"message": "Bulk order placed successfully.", "order": payload},
            status=status.HTTP_201_CREATED,
        )


class CommunityOrderConfirmationAPIView(APIView):
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
