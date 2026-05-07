"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.urls import path

from .views import (
    PublicMarketplaceProductDetailAPIView,
    PublicMarketplaceProductsAPIView,
    ProducerLowStockAlertsAPIView,
    ProducerOrderDetailAPIView,
    ProducerOrdersInboxAPIView,
    ProducerOrderStatusUpdateAPIView,
    ProducerProductDetailAPIView,
    ProducerProductHistoryAPIView,
    ProducerProductListCreateAPIView,
    ProducerSurplusDealAPIView,
)


urlpatterns = [
    path("public/products/", PublicMarketplaceProductsAPIView.as_view(), name="public-marketplace-products"),
    path("public/products/<int:pk>/", PublicMarketplaceProductDetailAPIView.as_view(), name="public-marketplace-product-detail"),
    path("products/", ProducerProductListCreateAPIView.as_view(), name="producer-product-list-create"),
    path("products/<int:pk>/", ProducerProductDetailAPIView.as_view(), name="producer-product-detail"),
    path("products/<int:pk>/history/", ProducerProductHistoryAPIView.as_view(), name="producer-product-history"),
    path("products/<int:pk>/surplus/", ProducerSurplusDealAPIView.as_view(), name="producer-product-surplus"),
    path("inventory/low-stock/", ProducerLowStockAlertsAPIView.as_view(), name="producer-low-stock-alerts"),
    path("orders/", ProducerOrdersInboxAPIView.as_view(), name="producer-orders-inbox"),
    path("orders/<int:pk>/", ProducerOrderDetailAPIView.as_view(), name="producer-order-detail"),
    path("orders/<int:pk>/status/", ProducerOrderStatusUpdateAPIView.as_view(), name="producer-order-status-update"),
]
