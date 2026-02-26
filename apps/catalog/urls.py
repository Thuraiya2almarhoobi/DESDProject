from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryListAPIView, ProductViewSet

router = DefaultRouter(trailing_slash=False)
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("", include(router.urls)),
    path("categories", CategoryListAPIView.as_view(), name="category-list"),
]
