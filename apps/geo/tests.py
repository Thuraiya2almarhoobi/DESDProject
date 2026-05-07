"""
DESD Marketplace documentation.

File role:
    Documents expected behavior through automated tests for this app's public contract.

Domain context:
    Geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.orders.models import CartItem, CustomerProfile, Producer, Product
from apps.orders.services import get_or_create_cart


User = get_user_model()


class GeoApiTests(APITestCase):
    """
    Documents the `GeoApiTests` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
        self.carrot_cart_item = CartItem.objects.create(cart=cart, product=product, quantity=Decimal("2.00"))

        second_producer = Producer.objects.create(
            business_name="South Bristol Growers", postcode="BS3 2AA", lead_time_hours=48
        )
        second_product = Product.objects.create(
            producer=second_producer,
            name="Spinach",
            unit="bunch",
            price=Decimal("1.80"),
            stock_quantity=Decimal("8.00"),
            is_available=True,
        )
        self.spinach_cart_item = CartItem.objects.create(
            cart=cart, product=second_product, quantity=Decimal("1.00")
        )

    def test_producers_near_me_endpoint(self):
        res = self.client.get("/api/geo/producers-near-me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("producers", res.data)
        self.assertGreaterEqual(len(res.data["producers"]), 1)

    def test_cart_food_miles_endpoint(self):
        res = self.client.get("/api/geo/food-miles/cart/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("total_food_miles", res.data)
        self.assertIn("producer_totals", res.data)
        self.assertIn("items", res.data)
        self.assertIn("max_producer_distance", res.data)
        self.assertIn("within_twenty_miles", res.data)
        self.assertGreaterEqual(len(res.data["producer_totals"]), 1)
        self.assertGreaterEqual(len(res.data["items"]), 1)
        self.assertGreaterEqual(Decimal(str(res.data["total_food_miles"])), Decimal("0.00"))

    def test_cart_food_miles_can_limit_to_selected_checkout_items(self):
        res = self.client.get(
            f"/api/geo/food-miles/cart/?cart_item_id={self.carrot_cart_item.id}"
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["items"]), 1)
        self.assertEqual(res.data["items"][0]["product_name"], "Carrots")
        self.assertEqual(len(res.data["producer_totals"]), 1)
        self.assertGreater(Decimal(str(res.data["max_producer_distance"])), Decimal("0.00"))
