"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.urls import path

from .views import (
    CartAPIView,
    CartItemAddAPIView,
    CartItemDetailAPIView,
    CheckoutAPIView,
    CheckoutPreviewAPIView,
    CustomerProfileAPIView,
    OrderDetailAPIView,
    OrderHistoryAPIView,
    OrderReceiptAPIView,
    OrderReorderAPIView,
    ProducerListCreateAPIView,
    ProducerSubOrderListAPIView,
    ProducerSubOrderStatusUpdateAPIView,
    ProductDetailAPIView,
    ProductReviewEligibilityAPIView,
    ProductReviewModerationAPIView,
    PendingReviewModerationQueueAPIView,
    ProductReviewResponseAPIView,
    ProductListCreateAPIView,
    ProductReviewsAPIView,
)

urlpatterns = [
    path("profile/", CustomerProfileAPIView.as_view(), name="orders-profile"),
    path("producers/", ProducerListCreateAPIView.as_view(), name="orders-producers"),
    path("products/", ProductListCreateAPIView.as_view(), name="orders-products"),
    path("products/<int:pk>/", ProductDetailAPIView.as_view(), name="orders-product-detail"),
    path("products/<int:product_id>/reviews/", ProductReviewsAPIView.as_view(), name="orders-product-reviews"),
    path(
        "products/<int:product_id>/reviews/eligibility/",
        ProductReviewEligibilityAPIView.as_view(),
        name="orders-product-review-eligibility",
    ),
    path(
        "products/<int:product_id>/reviews/<int:review_id>/response/",
        ProductReviewResponseAPIView.as_view(),
        name="orders-product-review-response",
    ),
    path(
        "products/<int:product_id>/reviews/<int:review_id>/moderate/",
        ProductReviewModerationAPIView.as_view(),
        name="orders-product-review-moderate",
    ),
    path(
        "reviews/moderation-queue/",
        PendingReviewModerationQueueAPIView.as_view(),
        name="orders-review-moderation-queue",
    ),
    path("cart/", CartAPIView.as_view(), name="orders-cart"),
    path("cart/items/", CartItemAddAPIView.as_view(), name="orders-cart-item-add"),
    path("cart/items/<int:item_id>/", CartItemDetailAPIView.as_view(), name="orders-cart-item-detail"),
    path("checkout/preview/", CheckoutPreviewAPIView.as_view(), name="orders-checkout-preview"),
    path("checkout/", CheckoutAPIView.as_view(), name="orders-checkout"),
    path("history/", OrderHistoryAPIView.as_view(), name="orders-history"),
    path("history/<int:order_id>/", OrderDetailAPIView.as_view(), name="orders-history-detail"),
    path("history/<int:order_id>/reorder/", OrderReorderAPIView.as_view(), name="orders-reorder"),
    path("history/<int:order_id>/receipt/", OrderReceiptAPIView.as_view(), name="orders-receipt"),
    path("producer/sub-orders/", ProducerSubOrderListAPIView.as_view(), name="orders-producer-sub-orders"),
    path(
        "producer/sub-orders/<int:sub_order_id>/status/",
        ProducerSubOrderStatusUpdateAPIView.as_view(),
        name="orders-producer-sub-order-status-update",
    ),
]
