"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

Domain context:
    Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryListAPIView, ProductViewSet

router = DefaultRouter(trailing_slash=False)
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("", include(router.urls)),
    path("categories", CategoryListAPIView.as_view(), name="category-list"),
]
