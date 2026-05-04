"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.urls import path

from .views import CartFoodMilesAPIView, ProducersNearMeAPIView

urlpatterns = [
    path("producers-near-me/", ProducersNearMeAPIView.as_view(), name="geo-producers-near-me"),
    path("food-miles/cart/", CartFoodMilesAPIView.as_view(), name="geo-food-miles-cart"),
]
