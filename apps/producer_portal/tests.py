from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.producer_portal.models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
    ProductAvailability,
)
from apps.producer_portal.serializers import ALLOWED_ALLERGENS

User = get_user_model()


class ProducerPortalCriticalTestCases(APITestCase):
    def setUp(self):
        self.producer = User.objects.create_user(
            username="producer_user",
            email="producer@example.com",
            password="test-pass-123",
        )
        self.other_producer = User.objects.create_user(
            username="other_producer",
            email="other@example.com",
            password="test-pass-123",
        )
        self.client.force_authenticate(self.producer)

    def _create_order(
        self,
        producer: User,
        order_number: str,
        delivery_offset_hours: int,
        customer_name: str = "Jane Customer",
    ) -> ProducerOrder:
        order_date = timezone.now()
        delivery_date = order_date + timedelta(hours=delivery_offset_hours)
        order = ProducerOrder(
            order_number=order_number,
            producer=producer,
            customer_name=customer_name,
            customer_email=f"{customer_name.lower().replace(' ', '.')}@mail.com",
            customer_phone="07700900123",
            delivery_address="45 Park Street, Bristol, BS1 5JG",
            order_date=order_date,
            delivery_date=delivery_date,
            status=OrderStatus.PENDING,
            total_value=Decimal("75.00"),
            special_instructions="Leave at side door",
        )
        order.full_clean()
        order.save()
        return order

    def test_tc_003_producer_lists_product_successfully(self):
        payload = {
            "name": "Organic Free Range Eggs",
            "category": "Dairy & Eggs",
            "description": "Fresh organic eggs from free-range hens, collected daily",
            "price": "3.50",
            "unit": "dozen",
            "availability": ProductAvailability.IN_SEASON,
            "stock_quantity": 50,
            "allergen_information": ["Eggs"],
            "harvest_date": timezone.localdate().isoformat(),
            "image_url": "https://example.com/eggs.jpg",
        }

        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        product = ProducerProduct.objects.get(id=create_response.data["id"])
        self.assertEqual(product.producer_id, self.producer.id)
        self.assertEqual(product.name, payload["name"])
        self.assertEqual(product.category, payload["category"])
        self.assertEqual(product.stock_quantity, 50)
        self.assertEqual(product.allergen_information, ["Eggs"])
        self.assertTrue(product.is_visible_to_customers)

        list_response = self.client.get("/api/producer/products/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["name"], payload["name"])
        self.assertEqual(list_response.data[0]["availability"], ProductAvailability.IN_SEASON)
        self.assertEqual(list_response.data[0]["allergen_information"], ["Eggs"])

    def test_product_rejects_allergen_values_outside_the_approved_list(self):
        payload = {
            "name": "Soup Mix",
            "category": "Prepared Foods",
            "description": "Ready to heat",
            "price": "4.50",
            "unit": "each",
            "availability": ProductAvailability.YEAR_ROUND,
            "stock_quantity": 10,
            "allergen_information": ["Chocolate"],
            "harvest_date": timezone.localdate().isoformat(),
        }

        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("allergen_information", create_response.data)

    def test_product_accepts_multiple_approved_allergens(self):
        payload = {
            "name": "Nutty Granola",
            "category": "Pantry",
            "description": "Toasted granola clusters",
            "price": "5.20",
            "unit": "each",
            "availability": ProductAvailability.YEAR_ROUND,
            "stock_quantity": 18,
            "allergen_information": [ALLOWED_ALLERGENS[1], ALLOWED_ALLERGENS[9], ALLOWED_ALLERGENS[13]],
            "harvest_date": timezone.localdate().isoformat(),
        }

        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["allergen_information"], payload["allergen_information"])

    def test_product_accepts_json_encoded_allergen_list_strings(self):
        payload = {
            "name": "Festival Salad",
            "category": "Prepared Foods",
            "description": "Mixed salad with dressing",
            "price": "6.10",
            "unit": "each",
            "availability": ProductAvailability.YEAR_ROUND,
            "stock_quantity": 7,
            "allergen_information": (
                '["Celery (including stalks, leaves, seeds, and root)", '
                '"Sulphur dioxide and sulphites (at concentrations above 10 parts per million)"]'
            ),
            "harvest_date": timezone.localdate().isoformat(),
        }

        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            create_response.data["allergen_information"],
            [
                "Celery (including stalks, leaves, seeds, and root)",
                "Sulphur dioxide and sulphites (at concentrations above 10 parts per million)",
            ],
        )

    def test_tc_009_producer_views_only_their_orders_sorted_by_delivery_date(self):
        product = ProducerProduct.objects.create(
            producer=self.producer,
            name="Organic Kale",
            category="Vegetables",
            description="Dark leafy greens",
            price=Decimal("2.50"),
            unit="kg",
            availability=ProductAvailability.YEAR_ROUND,
            stock_quantity=20,
            harvest_date=timezone.localdate(),
        )
        other_product = ProducerProduct.objects.create(
            producer=self.other_producer,
            name="Other Farm Milk",
            category="Dairy",
            description="Milk",
            price=Decimal("1.90"),
            unit="litre",
            availability=ProductAvailability.YEAR_ROUND,
            stock_quantity=15,
            harvest_date=timezone.localdate(),
        )

        o1 = self._create_order(self.producer, "ORD-1001", delivery_offset_hours=72, customer_name="Alpha Customer")
        o2 = self._create_order(self.producer, "ORD-1002", delivery_offset_hours=96, customer_name="Beta Customer")
        o3 = self._create_order(self.producer, "ORD-1003", delivery_offset_hours=120, customer_name="Gamma Customer")
        other_order = self._create_order(self.other_producer, "ORD-9999", delivery_offset_hours=72, customer_name="Delta Customer")

        for order in [o1, o2, o3]:
            ProducerOrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                quantity=Decimal("2.00"),
                unit_price=Decimal("2.50"),
            )
        ProducerOrderItem.objects.create(
            order=other_order,
            product=other_product,
            product_name=other_product.name,
            quantity=Decimal("1.00"),
            unit_price=Decimal("1.90"),
        )

        inbox_response = self.client.get("/api/producer/orders/")
        self.assertEqual(inbox_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(inbox_response.data), 3)
        self.assertEqual(
            [item["order_number"] for item in inbox_response.data],
            ["ORD-1001", "ORD-1002", "ORD-1003"],
        )
        for item in inbox_response.data:
            self.assertGreaterEqual(item["lead_time_hours"], 48)
            self.assertIn("customer_name", item)
            self.assertIn("delivery_date", item)
            self.assertIn("status", item)
            self.assertIn("total_value", item)

        detail_response = self.client.get(f"/api/producer/orders/{o1.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["order_number"], "ORD-1001")
        self.assertEqual(detail_response.data["items"][0]["product_name"], "Organic Kale")

        forbidden_response = self.client.get(f"/api/producer/orders/{other_order.id}/")
        self.assertEqual(forbidden_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_product_persists_via_demo_header_and_is_visible_in_public_feed(self):
        self.client.force_authenticate(user=None)
        payload = {
            "name": "Database Saved Lettuce",
            "category": "Vegetables",
            "description": "Saved through API and should remain after reload",
            "price": "2.20",
            "unit": "kg",
            "availability": ProductAvailability.YEAR_ROUND,
            "stock_quantity": 25,
            "allergen_information": "",
            "harvest_date": timezone.localdate().isoformat(),
        }
        create_response = self.client.post(
            "/api/producer/products/",
            payload,
            format="json",
            HTTP_X_DEMO_USER="producer@example.com",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        public_response = self.client.get("/api/producer/public/products/")
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["name"] == "Database Saved Lettuce" for item in public_response.data))

        producer_view = self.client.get("/api/producer/products/", HTTP_X_DEMO_USER="producer@example.com")
        self.assertEqual(producer_view.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["name"] == "Database Saved Lettuce" for item in producer_view.data))
