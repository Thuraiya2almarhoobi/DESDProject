from django.urls import path

from .views import CartFoodMilesAPIView, ProducersNearMeAPIView

urlpatterns = [
    path("producers-near-me/", ProducersNearMeAPIView.as_view(), name="geo-producers-near-me"),
    path("food-miles/cart/", CartFoodMilesAPIView.as_view(), name="geo-food-miles-cart"),
]
