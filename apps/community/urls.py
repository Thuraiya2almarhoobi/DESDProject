from django.urls import path

from .views import CommunityBulkCheckoutAPIView, CommunityOrderConfirmationAPIView


urlpatterns = [
    path("bulk-checkout/", CommunityBulkCheckoutAPIView.as_view(), name="community-bulk-checkout"),
    path(
        "orders/<int:order_id>/confirmation/",
        CommunityOrderConfirmationAPIView.as_view(),
        name="community-order-confirmation",
    ),
]
