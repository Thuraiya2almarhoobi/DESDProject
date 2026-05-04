"""
DESD Marketplace documentation.

File role:
    Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

Domain context:
    Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions, response, status
from rest_framework.views import APIView

from apps.orders.models import Producer, ProducerSubOrder

from .serializers import DeliveryJobSerializer
from .services import (
    cancel_delivery_job,
    dispatch_sub_order_to_stuart,
    handle_stuart_webhook_payload,
    latest_delivery_job,
    restart_delivery_job_simulation,
    refresh_delivery_job,
)

# Delivery-facing API views for Stuart webhooks and producer delivery actions.


def _producer_owned_sub_order(user, sub_order_id: int) -> ProducerSubOrder:
    """
    Helper for the file role: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

    `_producer_owned_sub_order` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    producer = get_object_or_404(Producer, user=user, is_active=True)
    return get_object_or_404(
        ProducerSubOrder.objects.select_related("order", "producer").prefetch_related("items"),
        id=sub_order_id,
        producer=producer,
    )


class StuartWebhookAPIView(APIView):
    """Receive Stuart delivery updates and apply them to local delivery state."""

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        expected_secret = (getattr(settings, "STUART_WEBHOOK_SECRET", "") or "").strip()
        provided_secret = (
            request.headers.get("X-Stuart-Webhook-Secret")
            or request.query_params.get("secret")
            or ""
        ).strip()
        if expected_secret and provided_secret != expected_secret:
            return response.Response({"detail": "Invalid Stuart webhook secret."}, status=status.HTTP_401_UNAUTHORIZED)
        if not isinstance(request.data, dict):
            return response.Response({"detail": "Webhook payload must be a JSON object."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = handle_stuart_webhook_payload(request.data)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(result, status=status.HTTP_200_OK)


class ProducerDeliveryRetryAPIView(APIView):
    """Dispatch or re-dispatch a producer sub-order to Stuart."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, sub_order_id: int):
        sub_order = _producer_owned_sub_order(request.user, sub_order_id)
        if sub_order.status in {sub_order.order.Status.DELIVERED, sub_order.order.Status.CANCELLED}:
            return response.Response(
                {"detail": "Retry is not available for delivered or cancelled orders."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = dispatch_sub_order_to_stuart(sub_order)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if sub_order.status != sub_order.order.Status.READY:
            sub_order.status = sub_order.order.Status.READY
            sub_order.save(update_fields=["status", "updated_at"])

        return response.Response(
            {
                "delivery": DeliveryJobSerializer(result.delivery_job).data,
                "sub_order_status": sub_order.status,
            },
            status=status.HTTP_201_CREATED,
        )


class ProducerDeliveryRefreshAPIView(APIView):
    """Refresh the latest Stuart delivery state for a producer sub-order."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, sub_order_id: int):
        sub_order = _producer_owned_sub_order(request.user, sub_order_id)
        delivery_job = latest_delivery_job(sub_order)
        if delivery_job is None:
            return response.Response({"detail": "No Stuart delivery exists for this order yet."}, status=status.HTTP_404_NOT_FOUND)

        try:
            refreshed = refresh_delivery_job(delivery_job)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        sub_order.refresh_from_db()
        return response.Response(
            {
                "delivery": DeliveryJobSerializer(refreshed).data,
                "sub_order_status": sub_order.status,
            },
            status=status.HTTP_200_OK,
        )


class ProducerDeliveryCancelAPIView(APIView):
    """Cancel the Stuart delivery attached to a producer sub-order."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, sub_order_id: int):
        sub_order = _producer_owned_sub_order(request.user, sub_order_id)
        delivery_job = latest_delivery_job(sub_order)
        if delivery_job is None:
            return response.Response({"detail": "No Stuart delivery exists for this order yet."}, status=status.HTTP_404_NOT_FOUND)

        try:
            cancelled = cancel_delivery_job(delivery_job)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return response.Response(
            {
                "delivery": DeliveryJobSerializer(cancelled).data,
                "sub_order_status": sub_order.status,
            },
            status=status.HTTP_200_OK,
        )


class ProducerDeliveryRestartSimulationAPIView(APIView):
    """Restart local delivery simulation timing for demo/test environments."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, sub_order_id: int):
        sub_order = _producer_owned_sub_order(request.user, sub_order_id)
        delivery_job = latest_delivery_job(sub_order)
        if delivery_job is None:
            return response.Response({"detail": "No Stuart delivery exists for this order yet."}, status=status.HTTP_404_NOT_FOUND)

        try:
            restarted = restart_delivery_job_simulation(delivery_job)
        except ValueError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        sub_order.refresh_from_db()
        return response.Response(
            {
                "delivery": DeliveryJobSerializer(restarted).data,
                "sub_order_status": sub_order.status,
            },
            status=status.HTTP_200_OK,
        )
