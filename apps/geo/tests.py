from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.orders.models import CartItem, CustomerProfile, Producer, Product
from apps.orders.services import get_or_create_cart


User = get_user_model()


class GeoApiTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(username="geo_customer", password="pass1234")
        self.client = APIClient()
        self.client.force_authenticate(self.customer)

        CustomerProfile.objects.create(
            user=self.customer, delivery_address="45 Park Street", postcode="BS1 5JG"
        )

        producer = Producer.objects.create(
            business_name="Bristol Valley Farm", postcode="BS1 4DJ", lead_time_hours=48
        )
        product = Product.objects.create(
            producer=producer,
            name="Carrots",
            unit="kg",
            price=Decimal("2.50"),
            stock_quantity=Decimal("10.00"),
            is_available=True,
        )

        cart = get_or_create_cart(self.customer)
        CartItem.objects.create(cart=cart, product=product, quantity=Decimal("2.00"))

    def test_producers_near_me_endpoint(self):
        res = self.client.get("/api/geo/producers-near-me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("producers", res.data)
        self.assertGreaterEqual(len(res.data["producers"]), 1)

    def test_cart_food_miles_endpoint(self):
        res = self.client.get("/api/geo/food-miles/cart/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("total_food_miles", res.data)
        self.assertGreaterEqual(Decimal(str(res.data["total_food_miles"])), Decimal("0.00"))
