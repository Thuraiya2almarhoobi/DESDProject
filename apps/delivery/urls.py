"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.urls import path

from .views import (
    ProducerDeliveryCancelAPIView,
    ProducerDeliveryRefreshAPIView,
    ProducerDeliveryRestartSimulationAPIView,
    ProducerDeliveryRetryAPIView,
    StuartWebhookAPIView,
)


urlpatterns = [
    path("stuart/webhook/", StuartWebhookAPIView.as_view(), name="delivery-stuart-webhook"),
    path(
        "producer/sub-orders/<int:sub_order_id>/delivery/retry/",
        ProducerDeliveryRetryAPIView.as_view(),
        name="delivery-producer-retry",
    ),
    path(
        "producer/sub-orders/<int:sub_order_id>/delivery/refresh/",
        ProducerDeliveryRefreshAPIView.as_view(),
        name="delivery-producer-refresh",
    ),
    path(
        "producer/sub-orders/<int:sub_order_id>/delivery/cancel/",
        ProducerDeliveryCancelAPIView.as_view(),
        name="delivery-producer-cancel",
    ),
    path(
        "producer/sub-orders/<int:sub_order_id>/delivery/restart-simulation/",
        ProducerDeliveryRestartSimulationAPIView.as_view(),
        name="delivery-producer-restart-simulation",
    ),
]
