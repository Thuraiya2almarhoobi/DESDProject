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
