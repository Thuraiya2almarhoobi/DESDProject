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
