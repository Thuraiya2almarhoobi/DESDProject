"""
DESD Marketplace documentation.

File role:
    Documents expected behavior through automated tests for this app's public contract.

Domain context:
    Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from calendar import month_abbr
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Product as CatalogProduct
from apps.orders.models import Producer as OrdersProducer
from apps.orders.models import Product as OrdersProduct
from apps.orders.models import FavoriteProducer, ProducerNotification, UserNotification
from apps.producer_portal.models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
    ProducerProductInventoryEvent,
    ProductAvailability,
)

User = get_user_model()


class ProducerPortalCriticalTestCases(APITestCase):
    """
    Documents the `ProducerPortalCriticalTestCases` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    def setUp(self):
        self.producer = User.objects.create_user(
            username="producer_user",
            email="producer@example.com",
            password="test-pass-123",
            role=User.Role.PRODUCER,
        )
        self.other_producer = User.objects.create_user(
            username="other_producer",
            email="other@example.com",
            password="test-pass-123",
            role=User.Role.PRODUCER,
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
        current_month = timezone.localdate().month
        payload = {
            "name": "Organic Free Range Eggs",
            "category": "Dairy & Eggs",
            "description": "Fresh organic eggs from free-range hens, collected daily",
            "price": "3.50",
            "unit": "dozen",
            "availability": ProductAvailability.IN_SEASON,
            "season_start_month": current_month,
            "season_end_month": current_month,
            "stock_quantity": 50,
            "low_stock_threshold": 14,
            "allergen_information": "Contains eggs",
            "storage_tips": "Keep refrigerated and use within seven days.",
            "storage_tips_ai_generated": True,
            "is_organic": True,
            "organic_certification": "Soil Association GB-ORG-05",
            "is_surplus": True,
            "surplus_discount_percent": 20,
            "surplus_expires_at": (timezone.now() + timedelta(hours=48)).isoformat(),
            "surplus_best_before": "Use within 3 days",
            "surplus_note": "Short-dated surplus batch from today's collection.",
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
        self.assertEqual(product.low_stock_threshold, 14)
        self.assertEqual(product.storage_tips, payload["storage_tips"])
        self.assertTrue(product.storage_tips_ai_generated)
        self.assertTrue(product.is_organic)
        self.assertEqual(product.organic_certification, payload["organic_certification"])
        self.assertTrue(product.is_surplus)
        self.assertEqual(product.surplus_discount_percent, Decimal("20"))
        self.assertEqual(product.surplus_best_before, payload["surplus_best_before"])
        self.assertEqual(product.surplus_note, payload["surplus_note"])
        self.assertTrue(product.is_visible_to_customers)

        list_response = self.client.get("/api/producer/products/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["name"], payload["name"])
        self.assertEqual(list_response.data[0]["availability"], ProductAvailability.IN_SEASON)
        self.assertEqual(list_response.data[0]["low_stock_threshold"], 14)
        self.assertEqual(list_response.data[0]["storage_tips"], payload["storage_tips"])
        self.assertTrue(list_response.data[0]["storage_tips_ai_generated"])
        self.assertTrue(list_response.data[0]["is_organic"])
        self.assertEqual(list_response.data[0]["organic_certification"], payload["organic_certification"])
        self.assertTrue(list_response.data[0]["is_surplus"])
        self.assertEqual(list_response.data[0]["surplus_best_before"], payload["surplus_best_before"])
        self.assertEqual(list_response.data[0]["surplus_note"], payload["surplus_note"])

    def test_surplus_product_creation_notifies_users_who_favorite_the_producer(self):
        orders_producer = OrdersProducer.objects.create(
            user=self.producer,
            business_name="Bristol Valley Farm",
            postcode="BS1 4DJ",
        )
        customer = User.objects.create_user(
            username="surplus_fan",
            email="surplus-fan@example.com",
            password="test-pass-123",
            role=User.Role.CUSTOMER,
        )
        FavoriteProducer.objects.create(user=customer, producer=orders_producer)

        response = self.client.post(
            "/api/producer/products/",
            {
                "name": "Rescue Tomatoes",
                "category": "Vegetables",
                "description": "Short-dated tomatoes for sauces and soups.",
                "price": "2.20",
                "unit": "kg",
                "availability": ProductAvailability.IN_SEASON,
                "season_start_month": timezone.localdate().month,
                "season_end_month": timezone.localdate().month,
                "stock_quantity": "12",
                "low_stock_threshold": 5,
                "allergen_information": "No common allergens",
                "harvest_date": timezone.localdate().isoformat(),
                "is_surplus": True,
                "surplus_discount_percent": 30,
                "surplus_expires_at": (timezone.now() + timedelta(hours=24)).isoformat(),
                "surplus_best_before": "Best before tomorrow",
                "surplus_note": "Cosmetic marks only.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = UserNotification.objects.get(user=customer, category="surplus_deal")
        self.assertIn("Bristol Valley Farm added a surplus deal", notification.message)
        self.assertEqual(notification.metadata["product_name"], "Rescue Tomatoes")

    def test_blank_storage_guidance_is_allowed_and_not_ai_labelled(self):
        current_month = timezone.localdate().month
        payload = {
            "name": "Seasonal Kale",
            "category": "Vegetables",
            "description": "Fresh leafy greens grown locally today",
            "price": "2.10",
            "unit": "kg",
            "availability": ProductAvailability.IN_SEASON,
            "season_start_month": current_month,
            "season_end_month": current_month,
            "stock_quantity": 24,
            "low_stock_threshold": 8,
            "allergen_information": "",
            "storage_tips": "",
            "storage_tips_ai_generated": True,
            "harvest_date": timezone.localdate().isoformat(),
        }

        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        product = ProducerProduct.objects.get(id=create_response.data["id"])
        self.assertEqual(product.storage_tips, "")
        self.assertFalse(product.storage_tips_ai_generated)
        self.assertEqual(create_response.data["storage_tips"], "")
        self.assertFalse(create_response.data["storage_tips_ai_generated"])

    def test_storage_guidance_has_server_side_character_limit(self):
        current_month = timezone.localdate().month
        response = self.client.post(
            "/api/producer/products/",
            {
                "name": "Long Storage Notes",
                "category": "Vegetables",
                "description": "Fresh produce",
                "price": "2.10",
                "unit": "kg",
                "availability": ProductAvailability.IN_SEASON,
                "season_start_month": current_month,
                "season_end_month": current_month,
                "stock_quantity": 24,
                "low_stock_threshold": 8,
                "allergen_information": "",
                "storage_tips": "x" * 701,
                "harvest_date": timezone.localdate().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("700 characters", str(response.data))

    def test_low_stock_threshold_persists_and_default_alert_filter_uses_saved_value(self):
        product = ProducerProduct.objects.create(
            producer=self.producer,
            name="Threshold Tomatoes",
            category="Vegetables",
            description="Low-stock threshold test",
            price=Decimal("2.10"),
            unit="kg",
            availability=ProductAvailability.YEAR_ROUND,
            stock_quantity=6,
            low_stock_threshold=7,
            harvest_date=timezone.localdate(),
        )

        patch_response = self.client.patch(
            f"/api/producer/products/{product.id}/",
            {"low_stock_threshold": 5},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertEqual(product.low_stock_threshold, 5)
        self.assertTrue(
            ProducerProductInventoryEvent.objects.filter(
                product=product,
                event_type="updated",
            ).exists()
        )

        low_stock_response = self.client.get("/api/producer/products/?low_stock=true")
        self.assertEqual(low_stock_response.status_code, status.HTTP_200_OK)
        self.assertEqual(low_stock_response.data, [])

        alert_response = self.client.get("/api/producer/inventory/low-stock/")
        self.assertEqual(alert_response.status_code, status.HTTP_200_OK)
        self.assertEqual(alert_response.data["count"], 0)

        product.low_stock_threshold = 6
        product.save(update_fields=["low_stock_threshold"])

        low_stock_response = self.client.get("/api/producer/products/?low_stock=true")
        self.assertEqual(low_stock_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(low_stock_response.data), 1)
        self.assertEqual(low_stock_response.data[0]["name"], "Threshold Tomatoes")

        alert_response = self.client.get("/api/producer/inventory/low-stock/")
        self.assertEqual(alert_response.status_code, status.HTTP_200_OK)
        self.assertEqual(alert_response.data["count"], 1)
        self.assertEqual(alert_response.data["results"][0]["low_stock_threshold"], 6)
        orders_producer = OrdersProducer.objects.get(user=self.producer)
        self.assertTrue(
            ProducerNotification.objects.filter(
                producer=orders_producer,
                category="low_stock",
                metadata__product_id=product.id,
                resolved_at__isnull=True,
            ).exists()
        )

        patch_response = self.client.patch(
            f"/api/producer/products/{product.id}/",
            {"stock_quantity": 10},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            ProducerNotification.objects.filter(
                producer=orders_producer,
                category="low_stock",
                metadata__product_id=product.id,
                resolved_at__isnull=True,
            ).exists()
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

    def test_product_create_requires_authenticated_producer_and_public_feed_stays_open(self):
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
        self.assertEqual(create_response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(self.producer)
        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        public_response = self.client.get("/api/producer/public/products/")
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["name"] == "Database Saved Lettuce" for item in public_response.data))

        producer_view = self.client.get("/api/producer/products/")
        self.assertEqual(producer_view.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["name"] == "Database Saved Lettuce" for item in producer_view.data))

    def test_product_syncs_into_orders_catalog_on_create_update_and_delete(self):
        payload = {
            "name": "Sync Ready Beetroot",
            "category": "Vegetables",
            "description": "Cross app sync validation for fresh beetroot",
            "price": "2.40",
            "unit": "kg",
            "availability": ProductAvailability.YEAR_ROUND,
            "stock_quantity": 14,
            "allergen_information": "",
            "is_organic": True,
            "organic_certification": "Soil Association GB-ORG-05",
            "is_surplus": True,
            "surplus_discount_percent": 25,
            "surplus_expires_at": (timezone.now() + timedelta(hours=36)).isoformat(),
            "surplus_best_before": "Best before tomorrow",
            "surplus_note": "Cosmetic marks only, quality checked.",
            "harvest_date": timezone.localdate().isoformat(),
        }
        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        orders_producer = OrdersProducer.objects.filter(user=self.producer).first()
        self.assertIsNotNone(orders_producer)
        self.assertTrue(
            OrdersProduct.objects.filter(
                producer=orders_producer,
                name="Sync Ready Beetroot",
                stock_quantity=Decimal("14.00"),
                is_available=True,
            ).exists()
        )
        self.assertTrue(
            CatalogProduct.objects.filter(
                producer__name=orders_producer.business_name,
                name="Sync Ready Beetroot",
                stock=14,
                is_organic=True,
                organic_certification="Soil Association GB-ORG-05",
                is_surplus=True,
                surplus_discount=25,
                surplus_best_before="Best before tomorrow",
            ).exists()
        )

        patch_response = self.client.patch(
            f"/api/producer/products/{create_response.data['id']}/",
            {
                "name": "Synced Beetroot Renamed",
                "stock_quantity": 0,
                "availability": ProductAvailability.UNAVAILABLE,
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            OrdersProduct.objects.filter(
                producer=orders_producer,
                name="Sync Ready Beetroot",
            ).exists()
        )
        self.assertTrue(
            OrdersProduct.objects.filter(
                producer=orders_producer,
                name="Synced Beetroot Renamed",
                stock_quantity=Decimal("0.00"),
                is_available=False,
            ).exists()
        )
        self.assertTrue(
            CatalogProduct.objects.filter(
                producer__name=orders_producer.business_name,
                name="Synced Beetroot Renamed",
                stock=0,
                availability="unavailable",
            ).exists()
        )

        delete_response = self.client.delete(f"/api/producer/products/{create_response.data['id']}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            OrdersProduct.objects.filter(
                producer=orders_producer,
                name="Synced Beetroot Renamed",
            ).exists()
        )
        self.assertFalse(
            CatalogProduct.objects.filter(
                producer__name=orders_producer.business_name,
                name="Synced Beetroot Renamed",
            ).exists()
        )

    def test_seasonal_product_requires_start_and_end_months(self):
        payload = {
            "name": "Spring Asparagus",
            "category": "Vegetables",
            "description": "Seasonal asparagus grown for spring harvest",
            "price": "4.10",
            "unit": "kg",
            "availability": ProductAvailability.IN_SEASON,
            "stock_quantity": 12,
            "allergen_information": "",
            "harvest_date": timezone.localdate().isoformat(),
        }

        response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("season_start_month", response.data)

    def test_future_season_product_exposes_reminder_and_stays_hidden_from_public_feed(self):
        today = timezone.localdate()
        start_month = (today.month % 12) + 1
        end_month = ((today.month + 2) % 12) + 1
        payload = {
            "name": "Summer Courgettes",
            "category": "Vegetables",
            "description": "Courgettes for the next season window.",
            "price": "2.70",
            "unit": "kg",
            "availability": ProductAvailability.IN_SEASON,
            "season_start_month": start_month,
            "season_end_month": end_month,
            "stock_quantity": 25,
            "allergen_information": "",
            "harvest_date": today.isoformat(),
        }

        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        producer_list = self.client.get("/api/producer/products/")
        self.assertEqual(producer_list.status_code, status.HTTP_200_OK)
        created = next(item for item in producer_list.data if item["name"] == "Summer Courgettes")
        self.assertEqual(created["effective_availability"], ProductAvailability.UNAVAILABLE)
        self.assertEqual(created["seasonal_window_label"], f"{month_abbr[start_month]} - {month_abbr[end_month]}")
        self.assertTrue(created["season_reminder_message"])

        public_feed = self.client.get("/api/producer/public/products/")
        self.assertEqual(public_feed.status_code, status.HTTP_200_OK)
        self.assertFalse(any(item["name"] == "Summer Courgettes" for item in public_feed.data))
    def test_delivered_producer_order_reduces_inventory_only_when_completed(self):
        payload = {
            "name": "Inventory Reduction Potatoes",
            "category": "Vegetables",
            "description": "Stock deduction verification for delivered orders",
            "price": "2.00",
            "unit": "kg",
            "availability": ProductAvailability.YEAR_ROUND,
            "stock_quantity": 100,
            "allergen_information": "",
            "harvest_date": timezone.localdate().isoformat(),
        }
        create_response = self.client.post("/api/producer/products/", payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        product = ProducerProduct.objects.get(id=create_response.data["id"])
        orders_producer = OrdersProducer.objects.get(user=self.producer)
        synced_orders_product = OrdersProduct.objects.get(
            producer=orders_producer,
            name=payload["name"],
        )

        order = self._create_order(
            self.producer,
            "ORD-DELIVER-STOCK-1",
            delivery_offset_hours=72,
            customer_name="Inventory Customer",
        )
        ProducerOrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            quantity=Decimal("5.00"),
            unit_price=Decimal("2.00"),
        )

        for next_status in [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY]:
            response_ = self.client.patch(
                f"/api/producer/orders/{order.id}/status/",
                {"status": next_status},
                format="json",
            )
            self.assertEqual(response_.status_code, status.HTTP_200_OK)
            product.refresh_from_db()
            synced_orders_product.refresh_from_db()
            self.assertEqual(product.stock_quantity, 100)
            self.assertEqual(synced_orders_product.stock_quantity, Decimal("100.00"))

        delivered_response = self.client.patch(
            f"/api/producer/orders/{order.id}/status/",
            {"status": OrderStatus.DELIVERED},
            format="json",
        )
        self.assertEqual(delivered_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delivered_response.data["status"], OrderStatus.DELIVERED)

        product.refresh_from_db()
        synced_orders_product.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.DELIVERED)
        self.assertEqual(product.stock_quantity, 95)
        self.assertEqual(synced_orders_product.stock_quantity, Decimal("95.00"))

        delivered_again_response = self.client.patch(
            f"/api/producer/orders/{order.id}/status/",
            {"status": OrderStatus.DELIVERED},
            format="json",
        )
        self.assertEqual(delivered_again_response.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 95)
