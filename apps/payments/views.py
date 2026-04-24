from __future__ import annotations

import csv

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, response, status
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.serializers import OrderDetailSerializer

from .models import WeeklySettlement
from .serializers import (
    StripeCheckoutCancelSerializer,
    StripeCheckoutSessionConfirmSerializer,
    StripeCheckoutSessionRequestSerializer,
    WeeklySettlementSerializer,
)
from .services import (
    cancel_stripe_checkout_order,
    confirm_stripe_checkout_session,
    create_stripe_checkout_session_for_order,
    handle_stripe_webhook_event,
    process_weekly_settlements,
    verify_and_construct_stripe_event,
)

# Payment-facing API views for Stripe checkout and producer settlements.


class StripeCheckoutSessionCreateAPIView(APIView):
    """Create a hosted Stripe Checkout session for the current buyer's order."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StripeCheckoutSessionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = get_object_or_404(
            Order.objects.prefetch_related("items"),
            pk=serializer.validated_data["order_id"],
            customer=request.user,
        )

        try:
            checkout_session = create_stripe_checkout_session_for_order(order)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return response.Response(
            {
                "order_id": order.id,
                "checkout_session_id": checkout_session.session_id,
                "checkout_url": checkout_session.checkout_url,
                "publishable_key": checkout_session.publishable_key,
                "test_mode": checkout_session.test_mode,
            },
            status=status.HTTP_201_CREATED,
        )


class StripeWebhookAPIView(APIView):
    """Receive Stripe webhook callbacks and hand them to the payment service."""

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        signature = request.headers.get("Stripe-Signature", "")
        if not signature:
            return response.Response(
                {"detail": "Missing Stripe-Signature header."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            event = verify_and_construct_stripe_event(request.body, signature)
            result = handle_stripe_webhook_event(event)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return response.Response(result, status=status.HTTP_200_OK)


class StripeCheckoutSessionConfirmAPIView(APIView):
    """Confirm the outcome of a Stripe Checkout return using the session ID."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StripeCheckoutSessionConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session_id = serializer.validated_data["session_id"]
        get_object_or_404(
            Order.objects.select_related("payment"),
            payment__provider="stripe",
            payment__provider_reference=session_id,
            customer=request.user,
        )

        try:
            result = confirm_stripe_checkout_session(session_id)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        order = get_object_or_404(
            Order.objects.prefetch_related("sub_orders__producer", "items"),
            pk=result["order_id"],
            customer=request.user,
        )
        payload = {**result, "order": OrderDetailSerializer(order).data}
        return response.Response(payload, status=status.HTTP_200_OK)


class StripeCheckoutCancelAPIView(APIView):
    """Release reserved stock and cancel a Stripe-driven checkout attempt."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StripeCheckoutCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = get_object_or_404(
            Order.objects.prefetch_related("sub_orders__producer", "items"),
            pk=serializer.validated_data["order_id"],
            customer=request.user,
        )

        try:
            result = cancel_stripe_checkout_order(order)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        order.refresh_from_db()
        payload = {**result, "order": OrderDetailSerializer(order).data}
        return response.Response(payload, status=status.HTTP_200_OK)


class WeeklySettlementListAPIView(generics.ListAPIView):
    """List weekly settlement summaries for the signed-in producer."""

    serializer_class = WeeklySettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WeeklySettlement.objects.filter(producer=self.request.user).prefetch_related("lines", "lines__order")


class WeeklySettlementDetailAPIView(generics.RetrieveAPIView):
    """Return one producer settlement with its line-level breakdown."""

    serializer_class = WeeklySettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WeeklySettlement.objects.filter(producer=self.request.user).prefetch_related("lines", "lines__order")


class WeeklySettlementExportCSVAPIView(APIView):
    """Export a producer settlement as CSV for reporting/accounting workflows."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int):
        settlement = get_object_or_404(
            WeeklySettlement.objects.prefetch_related("lines", "lines__order"),
            pk=pk,
            producer=request.user,
        )
        csv_response = HttpResponse(content_type="text/csv")
        csv_response["Content-Disposition"] = (
            f'attachment; filename="settlement-{settlement.week_start}-{settlement.week_end}.csv"'
        )
        writer = csv.writer(csv_response)
        writer.writerow(
            [
                "Transaction Reference",
                "Week Start",
                "Week End",
                "Order Number",
                "Customer Name",
                "Gross Amount",
                "Commission (5%)",
                "Net Amount",
                "Status",
            ]
        )
        for line in settlement.lines.all():
            writer.writerow(
                [
                    settlement.transaction_reference,
                    settlement.week_start.isoformat(),
                    settlement.week_end.isoformat(),
                    line.order.order_number,
                    line.customer_name,
                    f"{line.gross_amount:.2f}",
                    f"{line.commission_amount:.2f}",
                    f"{line.net_amount:.2f}",
                    settlement.status,
                ]
            )
        return csv_response


class TriggerWeeklySettlementsAPIView(APIView):
    """Staff-only endpoint that runs the settlement generation process."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return response.Response({"detail": "Only staff users can trigger settlement runs."}, status=403)

        settlements = process_weekly_settlements()
        payload = WeeklySettlementSerializer(settlements, many=True).data
        return response.Response(
            {"created_count": len(payload), "results": payload},
            status=status.HTTP_201_CREATED,
        )
