"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

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
