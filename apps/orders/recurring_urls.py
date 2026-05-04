"""
DESD Marketplace documentation.

File role:
    Source module for the orders area.

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

from .recurring_views import (
    RestaurantRecurringOrderDetailAPIView,
    RestaurantRecurringOrderGeneratedListAPIView,
    RestaurantRecurringOrderListCreateAPIView,
    RestaurantRecurringOrderNextInstanceAPIView,
    RestaurantRecurringOrderRunAPIView,
)


urlpatterns = [
    path(
        "recurring-orders/",
        RestaurantRecurringOrderListCreateAPIView.as_view(),
        name="restaurant-recurring-orders",
    ),
    path(
        "recurring-orders/run/",
        RestaurantRecurringOrderRunAPIView.as_view(),
        name="restaurant-recurring-orders-run",
    ),
    path(
        "recurring-orders/<int:pk>/",
        RestaurantRecurringOrderDetailAPIView.as_view(),
        name="restaurant-recurring-orders-detail",
    ),
    path(
        "recurring-orders/<int:pk>/next-instance/",
        RestaurantRecurringOrderNextInstanceAPIView.as_view(),
        name="restaurant-recurring-orders-next-instance",
    ),
    path(
        "recurring-orders/<int:pk>/generated/",
        RestaurantRecurringOrderGeneratedListAPIView.as_view(),
        name="restaurant-recurring-orders-generated",
    ),
]
