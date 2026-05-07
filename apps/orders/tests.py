"""
DESD Marketplace documentation.

File role:
    Documents expected behavior through automated tests for this app's public contract.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.catalog.models import Product as CatalogProduct
from apps.community.models import ProductReview
from apps.producer_portal.models import ProducerProduct, ProductAvailability

from .marketplace_sync import get_or_create_catalog_product_mirror
from apps.content.models import FarmStory, Recipe
from apps.moderation.models import ModerationAction

from .models import Cart, CustomerProfile, FavoriteProducer, Order, OrderItem, Producer, ProducerSubOrder, Product
from .models import ProductAllergenAcknowledgement, ProducerSubOrderStatusHistory, UserNotification


User = get_user_model()


class MockPaymentServiceResponse:
    """
    Documents the `MockPaymentServiceResponse` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


class OrdersCriticalFlowTests(APITestCase):
    """
    Documents the `OrdersCriticalFlowTests` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    def setUp(self):
        self.customer = User.objects.create_user(
            username="customer_tc",
            password="pass1234",
            role=User.Role.CUSTOMER,
        )
        self.producer_user_a = User.objects.create_user(
            username="producer_a",
            password="pass1234",
            role=User.Role.PRODUCER,
        )
        self.producer_user_b = User.objects.create_user(
            username="producer_b",
            password="pass1234",
            role=User.Role.PRODUCER,
        )

        self.producer_a = Producer.objects.create(
            user=self.producer_user_a,
            business_name="Bristol Valley Farm",
            postcode="BS1 4DJ",
            lead_time_hours=48,
        )
        self.producer_b = Producer.objects.create(
            user=self.producer_user_b,
            business_name="Hillside Dairy",
            postcode="BS3 2AA",
            lead_time_hours=48,
        )

        self.product_a1 = Product.objects.create(
            producer=self.producer_a,
            name="Organic Carrots",
            category="Vegetables",
            unit="kg",
            price=Decimal("2.50"),
            stock_quantity=Decimal("50.00"),
            is_available=True,
        )
        self.product_a2 = Product.objects.create(
            producer=self.producer_a,
            name="Parsnips",
            category="Vegetables",
            unit="kg",
            price=Decimal("3.00"),
            stock_quantity=Decimal("30.00"),
            is_available=True,
        )
        self.product_b1 = Product.objects.create(
            producer=self.producer_b,
            name="Fresh Milk",
            category="Dairy",
            unit="litre",
            price=Decimal("1.80"),
            stock_quantity=Decimal("40.00"),
            is_available=True,
        )

        CustomerProfile.objects.create(
            user=self.customer,
            full_name="Robert Johnson",
            delivery_address="45 Park Street, Bristol",
            postcode="BS1 5JG",
        )

        self.client = APIClient()
        self.client.force_authenticate(self.customer)
        self.payment_service_patcher = patch(
            "apps.payments.services.requests.post",
            side_effect=self._mock_payment_service_post,
        )
        self.payment_service_patcher.start()
        self.addCleanup(self.payment_service_patcher.stop)
        self.delivery_service_patcher = patch(
            "apps.delivery.services._service_request",
            side_effect=self._mock_delivery_service_request,
        )
        self.delivery_service_patcher.start()
        self.addCleanup(self.delivery_service_patcher.stop)

    def _mock_payment_service_post(self, url, json=None, headers=None, timeout=None):
        if url.endswith("/stripe/checkout-sessions"):
            order_id = str((json or {}).get("client_reference_id") or "0")
            return MockPaymentServiceResponse(
                201,
                {
                    "id": f"cs_test_order_{order_id}",
                    "url": f"https://checkout.stripe.com/c/pay/cs_test_order_{order_id}",
                    "livemode": False,
                    "publishable_key": "pk_test_checkout_key",
                },
            )
        raise AssertionError(f"Unexpected payment service request: {url}")

    def _mock_delivery_service_request(self, path, payload):
        if path == "/stuart/jobs":
            client_reference = str((payload or {}).get("client_reference") or "delivery")
            return {
                "job_id": f"job_{client_reference}",
                "package_id": f"pkg_{client_reference}",
                "client_reference": client_reference,
                "status": "created",
                "tracking_url": f"https://tracking.stuart.test/{client_reference}",
                "client_tracking_url": f"https://client.stuart.test/{client_reference}",
                "eta_to_dropoff": (timezone.now() + timedelta(minutes=45)).isoformat(),
                "courier_name": "Sandbox Courier",
                "courier_transport_type": "bike",
                "test_mode": True,
            }
        raise AssertionError(f"Unexpected Stuart delivery service request: {path}")

    def _add_to_cart(self, product: Product, quantity: str):
        return self.client.post(
            "/api/orders/cart/items/",
            {"product_id": product.id, "quantity": quantity},
            format="json",
        )

    def test_user_notification_panel_endpoint_lists_and_marks_read(self):
        first = UserNotification.objects.create(
            user=self.customer,
            category="order_status",
            message="Order BRF-TEST is now ready.",
            metadata={"order_id": 123},
        )
        second = UserNotification.objects.create(
            user=self.customer,
            category="surplus_deal",
            message="Bristol Valley Farm added a surplus deal: Lettuce at 30% off.",
            metadata={"producer_id": self.producer_a.id, "product_name": "Lettuce"},
        )

        list_res = self.client.get("/api/orders/notifications/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 2)
        self.assertEqual(list_res.data[0]["category"], "surplus_deal")

        patch_res = self.client.patch(
            "/api/orders/notifications/",
            {"ids": [first.id, second.id]},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data["updated"], 2)
        self.assertFalse(UserNotification.objects.filter(user=self.customer, is_read=False).exists())

    def _seed_delivered_purchase(self, product: Product, quantity: str = "1.00"):
        quantity_decimal = Decimal(quantity)
        subtotal = (product.price * quantity_decimal).quantize(Decimal("0.01"))
        commission_amount = (subtotal * Decimal("0.05")).quantize(Decimal("0.01"))
        payout_amount = (subtotal - commission_amount).quantize(Decimal("0.01"))

        order = Order.objects.create(
            customer=self.customer,
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            delivery_address="45 Park Street, Bristol",
            customer_postcode="BS1 5JG",
            special_instructions="Delivered order for review verification",
            subtotal_amount=subtotal,
            commission_rate=Decimal("0.05"),
            commission_amount=commission_amount,
            total_amount=subtotal,
            producer_payout_total=payout_amount,
            payment_method="test_card",
            payment_reference=f"PAY-{product.id}",
        )
        sub_order = ProducerSubOrder.objects.create(
            order=order,
            producer=product.producer,
            status=Order.Status.DELIVERED,
            delivery_date=timezone.localdate(),
            subtotal_amount=subtotal,
            commission_amount=commission_amount,
            payout_amount=payout_amount,
            notes="Delivered review verification seed",
        )
        OrderItem.objects.create(
            order=order,
            sub_order=sub_order,
            product=product,
            product_name=product.name,
            producer_name=product.producer.business_name,
            unit=product.unit,
            quantity=quantity_decimal,
            unit_price=product.price,
            line_total=subtotal,
        )
        return order

    def test_saved_producers_endpoint_returns_authenticated_user_favorites(self):
        FavoriteProducer.objects.create(user=self.customer, producer=self.producer_a)

        res = self.client.get("/api/orders/producers/favorites/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["business_name"], "Bristol Valley Farm")
        self.assertEqual(res.data[0]["user_id"], self.producer_user_a.id)

        self.client.force_authenticate(user=None)
        anon_res = self.client.get("/api/orders/producers/favorites/")
        self.assertEqual(anon_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tc006_add_and_manage_cart(self):
        add_a = self._add_to_cart(self.product_a1, "2")
        self.assertEqual(add_a.status_code, status.HTTP_200_OK)

        add_b = self._add_to_cart(self.product_b1, "3")
        self.assertEqual(add_b.status_code, status.HTTP_200_OK)

        cart_res = self.client.get("/api/orders/cart/")
        self.assertEqual(cart_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_res.data["producer_count"], 2)
        self.assertEqual(len(cart_res.data["groups"]), 2)

        first_item_id = cart_res.data["groups"][0]["items"][0]["cart_item_id"]
        update_res = self.client.patch(
            f"/api/orders/cart/items/{first_item_id}/", {"quantity": "3"}, format="json"
        )
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)

        item_after_update = update_res.data["cart"]["groups"][0]["items"][0]
        self.assertEqual(Decimal(str(item_after_update["quantity"])), Decimal("3.00"))

        second_item_id = update_res.data["cart"]["groups"][1]["items"][0]["cart_item_id"]
        delete_res = self.client.delete(f"/api/orders/cart/items/{second_item_id}/")
        self.assertEqual(delete_res.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_res.data["cart"]["producer_count"], 1)

    def test_tc007_single_producer_checkout_payment_flow(self):
        self._add_to_cart(self.product_a1, "2")
        self._add_to_cart(self.product_a2, "1")

        delivery_date = timezone.localdate() + timedelta(days=2)
        res = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "45 Park Street, Bristol",
                "customer_postcode": "BS1 5JG",
                "delivery_date": delivery_date.isoformat(),
                "payment_method": "test_card",
                "payment_token": "tok_visa",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data["order"]["id"]

        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.sub_orders.count(), 1)

        expected_subtotal = Decimal("2.50") * Decimal("2.00") + Decimal("3.00") * Decimal("1.00")
        self.assertEqual(order.subtotal_amount, expected_subtotal.quantize(Decimal("0.01")))
        self.assertEqual(order.commission_amount, (expected_subtotal * Decimal("0.05")).quantize(Decimal("0.01")))
        self.assertEqual(order.payment.provider, "mock")
        self.assertEqual(order.payment.status, "succeeded")
        self.assertEqual(order.sub_orders.first().producer, self.producer_a)
        self.assertTrue(order.payment.provider_reference.startswith("PAY-"))

    def test_tc008_multi_producer_split_checkout(self):
        self._add_to_cart(self.product_a1, "2")
        self._add_to_cart(self.product_b1, "3")

        delivery_date_a = timezone.localdate() + timedelta(days=2)
        delivery_date_b = timezone.localdate() + timedelta(days=3)
        res = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "45 Park Street, Bristol",
                "customer_postcode": "BS1 5JG",
                "producer_delivery_dates": {
                    str(self.producer_a.id): delivery_date_a.isoformat(),
                    str(self.producer_b.id): delivery_date_b.isoformat(),
                },
                "payment_method": "test_card",
                "payment_token": "tok_mastercard",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=res.data["order"]["id"])
        self.assertEqual(order.sub_orders.count(), 2)

        sub_order_a = order.sub_orders.get(producer=self.producer_a)
        sub_order_b = order.sub_orders.get(producer=self.producer_b)

        self.assertEqual(sub_order_a.delivery_date, delivery_date_a)
        self.assertEqual(sub_order_b.delivery_date, delivery_date_b)
        self.assertEqual(
            sub_order_a.commission_amount,
            (sub_order_a.subtotal_amount * Decimal("0.05")).quantize(Decimal("0.01")),
        )
        self.assertEqual(
            sub_order_b.commission_amount,
            (sub_order_b.subtotal_amount * Decimal("0.05")).quantize(Decimal("0.01")),
        )

        producer_client = APIClient()
        producer_client.force_authenticate(self.producer_user_a)
        producer_res = producer_client.get("/api/orders/producer/sub-orders/")
        self.assertEqual(producer_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(producer_res.data), 1)
        self.assertEqual(producer_res.data[0]["id"], sub_order_a.id)

    def test_checkout_can_process_only_selected_cart_items(self):
        self._add_to_cart(self.product_a1, "2")
        self._add_to_cart(self.product_b1, "3")

        cart_res = self.client.get("/api/orders/cart/")
        self.assertEqual(cart_res.status_code, status.HTTP_200_OK)

        selected_item_id = cart_res.data["groups"][0]["items"][0]["cart_item_id"]
        selected_producer_id = cart_res.data["groups"][0]["producer_id"]

        checkout_res = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "45 Park Street, Bristol",
                "customer_postcode": "BS1 5JG",
                "selected_cart_item_ids": [selected_item_id],
                "delivery_date": (timezone.localdate() + timedelta(days=2)).isoformat(),
                "producer_delivery_dates": {
                    str(selected_producer_id): (timezone.localdate() + timedelta(days=2)).isoformat(),
                },
                "payment_method": "test_card",
                "payment_token": "tok_selected",
            },
            format="json",
        )
        self.assertEqual(checkout_res.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=checkout_res.data["order"]["id"])
        self.assertEqual(order.sub_orders.count(), 1)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().product, self.product_a1)

        cart = Cart.objects.get(customer=self.customer)
        self.assertEqual(cart.items.count(), 1)
        self.assertEqual(cart.items.first().product, self.product_b1)

    def test_checkout_rejects_unacknowledged_allergen_products_then_allows_acknowledged_items(self):
        self.product_a1.allergen_info = "Nuts"
        self.product_a1.save(update_fields=["allergen_info", "updated_at"])

        self._add_to_cart(self.product_a1, "1")
        checkout_payload = {
            "delivery_address": "45 Park Street, Bristol",
            "customer_postcode": "BS1 5JG",
            "delivery_date": (timezone.localdate() + timedelta(days=2)).isoformat(),
            "payment_method": "test_card",
            "payment_token": "tok_allergen",
        }
        blocked_response = self.client.post("/api/orders/checkout/", checkout_payload, format="json")
        self.assertEqual(blocked_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Review allergen information", blocked_response.data["detail"])

        ack_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/allergen-acknowledgement/",
            {},
            format="json",
        )
        self.assertEqual(ack_response.status_code, status.HTTP_200_OK)
        self.assertTrue(ack_response.data["acknowledged"])
        self.assertTrue(
            ProductAllergenAcknowledgement.objects.filter(
                user=self.customer,
                product=self.product_a1,
            ).exists()
        )

        checkout_response = self.client.post("/api/orders/checkout/", checkout_payload, format="json")
        self.assertEqual(checkout_response.status_code, status.HTTP_201_CREATED)

    def test_order_history_receipt_and_reorder(self):
        self._add_to_cart(self.product_a1, "1")
        delivery_date = (timezone.localdate() + timedelta(days=2)).isoformat()
        checkout_res = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "45 Park Street, Bristol",
                "customer_postcode": "BS1 5JG",
                "delivery_date": delivery_date,
                "payment_method": "test_card",
                "payment_token": "tok_visa",
            },
            format="json",
        )
        self.assertEqual(checkout_res.status_code, status.HTTP_201_CREATED)
        order_id = checkout_res.data["order"]["id"]

        history_res = self.client.get("/api/orders/history/")
        self.assertEqual(history_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(history_res.data), 1)
        self.assertEqual(history_res.data[0]["delivery_date_from"], delivery_date)
        self.assertEqual(history_res.data[0]["delivery_date_to"], delivery_date)
        self.assertEqual(history_res.data[0]["sub_orders"][0]["status"], Order.Status.PENDING)
        self.assertIn("delivery", history_res.data[0]["sub_orders"][0])

        filter_res = self.client.get(
            "/api/orders/history/",
            {"producer_name": "Bristol Valley Farm", "from_date": timezone.localdate().isoformat()},
        )
        self.assertEqual(filter_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filter_res.data), 1)

        receipt_res = self.client.get(f"/api/orders/history/{order_id}/receipt/")
        self.assertEqual(receipt_res.status_code, status.HTTP_200_OK)
        self.assertIn("attachment;", receipt_res["Content-Disposition"])

        self.product_a1.is_available = False
        self.product_a1.save(update_fields=["is_available"])

        reorder_res = self.client.post(f"/api/orders/history/{order_id}/reorder/")
        self.assertEqual(reorder_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(reorder_res.data["unavailable_items"]), 1)

    def test_orders_product_routes_use_checkout_product_ids_for_marketplace_and_reviews(self):
        ProducerProduct.objects.create(
            producer=self.producer_user_a,
            name=self.product_a1.name,
            description="Fresh local carrots",
            category=self.product_a1.category,
            unit=self.product_a1.unit,
            price=self.product_a1.price,
            stock_quantity=10,
            availability=ProductAvailability.IN_SEASON,
            season_start_month=1,
            season_end_month=3,
            harvest_date=timezone.localdate(),
            storage_tips="Keep carrots chilled in a breathable bag.",
            storage_tips_ai_generated=True,
            is_organic=True,
            organic_certification="Soil Association GB-ORG-05",
            is_surplus=True,
            surplus_discount_percent=30,
            surplus_expires_at=timezone.now() + timedelta(hours=30),
            surplus_best_before="Best before tomorrow",
            surplus_note="Short-dated carrots, still crisp and quality checked.",
        )

        list_response = self.client.get("/api/orders/products/", {"available": "true"})
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 3)
        self.assertTrue(any(product["id"] == self.product_a1.id for product in list_response.data))

        detail_response = self.client.get(f"/api/orders/products/{self.product_a1.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["id"], self.product_a1.id)
        self.assertEqual(detail_response.data["name"], self.product_a1.name)
        self.assertEqual(detail_response.data["producer_name"], self.producer_a.business_name)
        self.assertIn("image_url", detail_response.data)
        self.assertEqual(detail_response.data["storage_tips"], "Keep carrots chilled in a breathable bag.")
        self.assertTrue(detail_response.data["storage_tips_ai_generated"])
        self.assertTrue(detail_response.data["is_organic"])
        self.assertEqual(detail_response.data["organic_certification"], "Soil Association GB-ORG-05")
        self.assertTrue(detail_response.data["is_surplus"])
        self.assertEqual(detail_response.data["surplus_discount"], 30)
        self.assertEqual(detail_response.data["surplus_best_before"], "Best before tomorrow")
        self.assertEqual(detail_response.data["surplus_note"], "Short-dated carrots, still crisp and quality checked.")

        organic_response = self.client.get("/api/orders/products/", {"available": "true", "organic": "true"})
        self.assertEqual(organic_response.status_code, status.HTTP_200_OK)
        organic_ids = {product["id"] for product in organic_response.data}
        self.assertIn(self.product_a1.id, organic_ids)
        self.assertNotIn(self.product_a2.id, organic_ids)

        reviews_response = self.client.get(f"/api/orders/products/{self.product_a1.id}/reviews/")
        self.assertEqual(reviews_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reviews_response.data, [])

        self._seed_delivered_purchase(self.product_a1)
        create_review_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 5, "title": "Fresh and consistent", "comment": "Fresh and consistent."},
            format="json",
        )
        self.assertEqual(create_review_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_review_response.data["title"], "Fresh and consistent")
        self.assertEqual(create_review_response.data["rating"], 5)
        self.assertEqual(create_review_response.data["reviewer_name"], "customer_tc")
        self.assertTrue(create_review_response.data["verified_purchase"])
        self.assertEqual(create_review_response.data["moderation_status"], "published")

        updated_list_response = self.client.get("/api/orders/products/", {"available": "true"})
        reviewed_product = next(product for product in updated_list_response.data if product["id"] == self.product_a1.id)
        self.assertEqual(reviewed_product["review_count"], 1)
        self.assertEqual(reviewed_product["average_rating"], 5.0)

    def test_organic_filter_uses_inference_when_synced_portal_product_is_unflagged(self):
        self.product_a2.description = "Naturally organic parsnips harvested locally."
        self.product_a2.save(update_fields=["description"])
        ProducerProduct.objects.create(
            producer=self.producer_user_a,
            name=self.product_a2.name,
            description=self.product_a2.description,
            category=self.product_a2.category,
            unit=self.product_a2.unit,
            price=self.product_a2.price,
            stock_quantity=10,
            availability=ProductAvailability.IN_SEASON,
            harvest_date=timezone.localdate(),
            is_organic=False,
            organic_certification="",
        )

        organic_response = self.client.get("/api/orders/products/", {"available": "true", "organic": "true"})
        self.assertEqual(organic_response.status_code, status.HTTP_200_OK)
        organic_ids = {product["id"] for product in organic_response.data}
        self.assertIn(self.product_a2.id, organic_ids)

        detail_response = self.client.get(f"/api/orders/products/{self.product_a2.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertTrue(detail_response.data["is_organic"])
        self.assertEqual(detail_response.data["organic_certification"], "Organic")

    def test_marketplace_product_search_handles_common_typos(self):
        product_response = self.client.get("/api/orders/products/", {"available": "true", "search": "orgnic carots"})
        self.assertEqual(product_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(product_response.data), 1)
        self.assertEqual(product_response.data[0]["name"], "Organic Carrots")

        producer_response = self.client.get("/api/orders/products/", {"available": "true", "search": "hilsde dary"})
        self.assertEqual(producer_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(producer_response.data), 1)
        self.assertEqual(producer_response.data[0]["name"], "Fresh Milk")

        empty_response = self.client.get("/api/orders/products/", {"available": "true", "search": "zzzz"})
        self.assertEqual(empty_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(empty_response.data), 0)

    def test_orders_product_list_heals_duplicate_catalog_mirrors(self):
        catalog_product = get_or_create_catalog_product_mirror(self.product_b1)
        duplicate_product = CatalogProduct.objects.create(
            producer=catalog_product.producer,
            category=catalog_product.category,
            name=catalog_product.name,
            description=catalog_product.description,
            price=catalog_product.price,
            unit=catalog_product.unit,
            harvest_date=catalog_product.harvest_date,
            availability=catalog_product.availability,
            seasonal_dates=catalog_product.seasonal_dates,
            is_organic=catalog_product.is_organic,
            organic_certification=catalog_product.organic_certification,
            allergens=catalog_product.allergens,
            image_url=catalog_product.image_url,
            stock=catalog_product.stock,
            food_miles=catalog_product.food_miles,
            is_surplus=catalog_product.is_surplus,
            surplus_discount=catalog_product.surplus_discount,
            surplus_original_price=catalog_product.surplus_original_price,
            surplus_expires_at=catalog_product.surplus_expires_at,
            surplus_best_before=catalog_product.surplus_best_before,
            storage_tips=catalog_product.storage_tips,
            recipe_ideas=catalog_product.recipe_ideas,
        )
        ProductReview.objects.create(
            product=duplicate_product,
            user=self.customer,
            reviewer_name="customer_tc",
            rating=4,
            title="Still works",
            comment="Duplicate catalog mirrors should not break marketplace loading.",
            verified_purchase=True,
        )

        list_response = self.client.get("/api/orders/products/", {"available": "true"})

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        reviewed_product = next(product for product in list_response.data if product["id"] == self.product_b1.id)
        self.assertEqual(reviewed_product["review_count"], 1)
        self.assertEqual(reviewed_product["average_rating"], 4.0)
        self.assertEqual(
            CatalogProduct.objects.filter(
                producer=catalog_product.producer,
                name=catalog_product.name,
                unit=catalog_product.unit,
            ).count(),
            1,
        )

    def test_review_submission_requires_delivered_purchase(self):
        response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 5, "title": "Trying too early", "comment": "Trying to review too early."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("delivered purchase", str(response.data).lower())

    def test_logged_out_user_cannot_submit_review(self):
        anonymous_client = APIClient()
        response = anonymous_client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 5, "title": "Should fail", "comment": "Should fail while signed out."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_review_eligibility_requires_login_for_submission(self):
        anonymous_client = APIClient()
        response = anonymous_client.get(
            f"/api/orders/products/{self.product_a1.id}/reviews/eligibility/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["can_submit"])
        self.assertFalse(response.data["is_authenticated"])
        self.assertIn("sign in", response.data["reason"].lower())

    def test_suspicious_review_is_published_until_reported(self):
        self._seed_delivered_purchase(self.product_a1)

        response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {
                "rating": 2,
                "title": "Spammy review",
                "comment": "BUY NOW!!! Visit https://spam.example for my full review!!!!!!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["moderation_status"], "published")
        self.assertEqual(response.data["moderation_reason"], "")

        reviews_response = self.client.get(f"/api/orders/products/{self.product_a1.id}/reviews/")
        self.assertEqual(reviews_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(reviews_response.data), 1)
        self.assertEqual(reviews_response.data[0]["id"], response.data["id"])

    def test_admin_can_remove_reported_review_and_verified_label_depends_on_order_history(self):
        self._seed_delivered_purchase(self.product_a1)
        review_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {
                "rating": 4,
                "title": "Needs moderation",
                "comment": "BUY NOW!!! Visit https://spam.example for my full review!!!!!!",
            },
            format="json",
        )
        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)
        review_id = review_response.data["id"]
        self.assertTrue(review_response.data["verified_purchase"])

        report_response = self.client.post(
            "/api/moderation/reports/",
            {"target_type": "review", "object_id": review_id, "reason": "Reported by customer."},
            format="json",
        )
        self.assertEqual(report_response.status_code, status.HTTP_201_CREATED)

        admin_user = User.objects.create_user(
            email="admin-review@example.com",
            password="pass1234",
            role=User.Role.ADMIN,
        )
        admin_client = APIClient()
        admin_client.force_authenticate(admin_user)
        moderation_response = admin_client.post(
            f"/api/moderation/reports/{report_response.data['id']}/remove/",
            {"note": "Removed by moderator."},
            format="json",
        )
        self.assertEqual(moderation_response.status_code, status.HTTP_200_OK, moderation_response.data)
        self.assertEqual(moderation_response.data["status"], "removed")

        reviews_response = self.client.get(f"/api/orders/products/{self.product_a1.id}/reviews/")
        self.assertEqual(reviews_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reviews_response.data, [])

        removed_review = ProductReview.objects.get(id=review_id)
        self.assertEqual(removed_review.moderation_status, ProductReview.ModerationStatus.REJECTED)

    def test_admin_moderation_reports_show_reporter_and_target_snapshot(self):
        self._seed_delivered_purchase(self.product_a1)
        review_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {
                "rating": 4,
                "title": "Reported review",
                "comment": "BUY NOW!!! Visit https://spam.example for my full review!!!!!!",
            },
            format="json",
        )
        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)
        report_response = self.client.post(
            "/api/moderation/reports/",
            {"target_type": "review", "object_id": review_response.data["id"], "reason": "Looks promotional."},
            format="json",
        )
        self.assertEqual(report_response.status_code, status.HTTP_201_CREATED)

        admin_user = User.objects.create_user(
            email="admin-queue@example.com",
            password="pass1234",
            role=User.Role.ADMIN,
        )
        admin_client = APIClient()
        admin_client.force_authenticate(admin_user)
        queue_response = admin_client.get("/api/moderation/reports/?status=open")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 1)
        self.assertEqual(queue_response.data[0]["target_type"], "review")
        self.assertEqual(queue_response.data[0]["reported_by"], self.customer.id)
        self.assertEqual(queue_response.data[0]["target_snapshot"]["title"], "Reported review")
        self.assertEqual(queue_response.data[0]["target_snapshot"]["reviewer_email"], self.customer.email)
        self.assertEqual(queue_response.data[0]["target_context"]["profile"]["product"], self.product_a1.name)
        self.assertEqual(queue_response.data[0]["target_context"]["profile"]["reviewer_user_id"], self.customer.id)
        self.assertEqual(queue_response.data[0]["reason"], "Looks promotional.")

        users_response = admin_client.get("/api/moderation/users/", {"q": self.customer.email})
        self.assertEqual(users_response.status_code, status.HTTP_200_OK)
        self.assertEqual(users_response.data[0]["email"], self.customer.email)
        self.assertTrue(users_response.data[0]["moderation_context"]["related_items"])

        deactivate_response = admin_client.post(
            f"/api/moderation/users/{self.customer.id}/action/",
            {"action": "deactivate"},
            format="json",
        )
        self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

    def test_admin_can_browse_and_directly_action_core_moderation_items(self):
        self._seed_delivered_purchase(self.product_a1)
        review_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 4, "title": "Useful review", "comment": "Fresh produce and clear collection."},
            format="json",
        )
        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)
        recipe = Recipe.objects.create(
            producer=self.producer_a,
            title="Carrot soup",
            description="Seasonal carrot recipe",
            ingredients="Carrots",
            instructions="Cook slowly.",
        )
        story = FarmStory.objects.create(
            producer=self.producer_a,
            title="Spring harvest",
            body="A story about the farm.",
        )
        admin_user = User.objects.create_user(
            email="admin-items@example.com",
            password="pass1234",
            role=User.Role.ADMIN,
        )
        admin_client = APIClient()
        admin_client.force_authenticate(admin_user)

        producer_search = admin_client.get("/api/moderation/items/", {"q": "Bristol Valley", "type": "producer_account"})
        self.assertEqual(producer_search.status_code, status.HTTP_200_OK, producer_search.data)
        self.assertGreaterEqual(producer_search.data["count"], 1)
        self.assertEqual(producer_search.data["results"][0]["target_type"], "producer_account")

        product_search = admin_client.get("/api/moderation/items/", {"q": "Organic Carrots", "type": "product"})
        self.assertEqual(product_search.status_code, status.HTTP_200_OK, product_search.data)
        self.assertEqual(product_search.data["results"][0]["label"], "Organic Carrots")

        recipe_search = admin_client.get("/api/moderation/items/", {"q": "Carrot soup", "type": "recipe"})
        self.assertEqual(recipe_search.status_code, status.HTTP_200_OK, recipe_search.data)
        self.assertEqual(recipe_search.data["results"][0]["object_id"], recipe.id)

        story_detail = admin_client.get(f"/api/moderation/items/farm_story/{story.id}/")
        self.assertEqual(story_detail.status_code, status.HTTP_200_OK, story_detail.data)
        self.assertEqual(story_detail.data["label"], "Spring harvest")
        self.assertEqual(story_detail.data["reports"], [])

        missing_note = admin_client.post(
            f"/api/moderation/items/product/{self.product_a1.id}/action/",
            {"action": "remove", "note": ""},
            format="json",
        )
        self.assertEqual(missing_note.status_code, status.HTTP_400_BAD_REQUEST)

        remove_product = admin_client.post(
            f"/api/moderation/items/product/{self.product_a1.id}/action/",
            {"action": "remove", "note": "Listing is not suitable."},
            format="json",
        )
        self.assertEqual(remove_product.status_code, status.HTTP_200_OK, remove_product.data)
        self.product_a1.refresh_from_db()
        self.assertFalse(self.product_a1.is_available)
        self.assertTrue(
            ModerationAction.objects.filter(
                target_type="product",
                object_id=self.product_a1.id,
                action="remove",
                note="Listing is not suitable.",
            ).exists()
        )
        removed_filter = admin_client.get("/api/moderation/items/", {"reported": "removed"})
        self.assertEqual(removed_filter.status_code, status.HTTP_200_OK, removed_filter.data)
        self.assertTrue(
            any(
                item["target_type"] == "product" and item["object_id"] == self.product_a1.id
                for item in removed_filter.data["results"]
            )
        )

        report_response = self.client.post(
            "/api/moderation/reports/",
            {"target_type": "product", "object_id": self.product_b1.id, "reason": "Check this listing."},
            format="json",
        )
        self.assertEqual(report_response.status_code, status.HTTP_201_CREATED, report_response.data)
        keep_response = admin_client.post(
            f"/api/moderation/reports/{report_response.data['id']}/keep/",
            {"note": "Listing is acceptable."},
            format="json",
        )
        self.assertEqual(keep_response.status_code, status.HTTP_200_OK, keep_response.data)
        kept_filter = admin_client.get("/api/moderation/items/", {"reported": "kept"})
        self.assertEqual(kept_filter.status_code, status.HTTP_200_OK, kept_filter.data)
        self.assertTrue(
            any(
                item["target_type"] == "product" and item["object_id"] == self.product_b1.id
                for item in kept_filter.data["results"]
            )
        )
        remove_kept_item = admin_client.post(
            f"/api/moderation/items/product/{self.product_b1.id}/action/",
            {"action": "remove", "note": "Removed after being kept live."},
            format="json",
        )
        self.assertEqual(remove_kept_item.status_code, status.HTTP_200_OK, remove_kept_item.data)
        kept_after_removed_filter = admin_client.get("/api/moderation/items/", {"reported": "kept"})
        self.assertEqual(kept_after_removed_filter.status_code, status.HTTP_200_OK, kept_after_removed_filter.data)
        self.assertTrue(
            any(
                item["target_type"] == "product" and item["object_id"] == self.product_b1.id and item["visibility"] == "removed"
                for item in kept_after_removed_filter.data["results"]
            )
        )
        removed_after_kept_filter = admin_client.get("/api/moderation/items/", {"reported": "removed"})
        self.assertEqual(removed_after_kept_filter.status_code, status.HTTP_200_OK, removed_after_kept_filter.data)
        self.assertTrue(
            any(
                item["target_type"] == "product" and item["object_id"] == self.product_b1.id
                for item in removed_after_kept_filter.data["results"]
            )
        )
        visibility_removed_filter = admin_client.get("/api/moderation/items/", {"visibility": "removed"})
        self.assertEqual(visibility_removed_filter.status_code, status.HTTP_200_OK, visibility_removed_filter.data)
        self.assertTrue(
            any(
                item["target_type"] == "product" and item["object_id"] == self.product_b1.id
                for item in visibility_removed_filter.data["results"]
            )
        )

        restore_recipe = admin_client.post(
            f"/api/moderation/items/recipe/{recipe.id}/action/",
            {"action": "remove", "note": "Temporarily unpublish."},
            format="json",
        )
        self.assertEqual(restore_recipe.status_code, status.HTTP_200_OK, restore_recipe.data)
        recipe.refresh_from_db()
        self.assertFalse(recipe.is_published)
        restore_recipe = admin_client.post(
            f"/api/moderation/items/recipe/{recipe.id}/action/",
            {"action": "restore", "note": "Content reviewed."},
            format="json",
        )
        self.assertEqual(restore_recipe.status_code, status.HTTP_200_OK, restore_recipe.data)
        recipe.refresh_from_db()
        self.assertTrue(recipe.is_published)

        deactivate_user = admin_client.post(
            f"/api/moderation/items/customer_account/{self.customer.id}/action/",
            {"action": "deactivate", "note": "Account issue."},
            format="json",
        )
        self.assertEqual(deactivate_user.status_code, status.HTTP_200_OK, deactivate_user.data)
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        blocked_admin_action = admin_client.post(
            f"/api/moderation/items/customer_account/{admin_user.id}/action/",
            {"action": "deactivate", "note": "Should not work."},
            format="json",
        )
        self.assertIn(blocked_admin_action.status_code, {status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND})

    def test_customer_cannot_report_same_product_twice(self):
        first_response = self.client.post(
            "/api/moderation/reports/",
            {"target_type": "product", "object_id": self.product_a1.id, "reason": "Product listing issue."},
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first_response.data["target_type"], "product")

        status_response = self.client.get(
            "/api/moderation/reports/my-status/",
            {"target_type": "product", "object_id": self.product_a1.id},
        )
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertTrue(status_response.data["reported"])
        self.assertEqual(status_response.data["status"], "open")

        duplicate_response = self.client.post(
            "/api/moderation/reports/",
            {"target_type": "product", "object_id": self.product_a1.id, "reason": "Reporting again."},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already reported", str(duplicate_response.data).lower())

    def test_non_admin_cannot_access_moderation_reports(self):
        response = self.client.get("/api/moderation/reports/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_producer_can_respond_to_published_review_for_own_product(self):
        self._seed_delivered_purchase(self.product_a1)
        review_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 4, "title": "Fresh and reliable", "comment": "Fresh and reliable."},
            format="json",
        )
        self.assertEqual(review_response.status_code, status.HTTP_201_CREATED)
        review_id = review_response.data["id"]

        producer_client = APIClient()
        producer_client.force_authenticate(self.producer_user_a)
        response = producer_client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/{review_id}/response/",
            {"producer_response": "Thanks for the feedback. We will keep this batch schedule going."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Thanks for the feedback", response.data["producer_response"])

        non_owner_client = APIClient()
        non_owner_client.force_authenticate(self.producer_user_b)
        forbidden = non_owner_client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/{review_id}/response/",
            {"producer_response": "This should not work."},
            format="json",
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_review_is_blocked_for_same_customer_and_product(self):
        self._seed_delivered_purchase(self.product_a1)
        first_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 5, "title": "Excellent quality", "comment": "Great vegetables."},
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        duplicate_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 4, "title": "Second try", "comment": "Trying to submit again."},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already reviewed", str(duplicate_response.data).lower())

    def test_customer_can_edit_existing_review_without_creating_duplicate(self):
        self._seed_delivered_purchase(self.product_a1)
        create_response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 4, "title": "Good carrots", "comment": "Fresh and clean."},
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        review_id = create_response.data["id"]

        eligibility_response = self.client.get(
            f"/api/orders/products/{self.product_a1.id}/reviews/eligibility/"
        )
        self.assertEqual(eligibility_response.status_code, status.HTTP_200_OK)
        self.assertEqual(eligibility_response.data["existing_review"]["id"], review_id)

        update_response = self.client.patch(
            f"/api/orders/products/{self.product_a1.id}/reviews/{review_id}/",
            {"rating": 5, "title": "Excellent carrots", "comment": "Updated after cooking."},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["rating"], 5)
        self.assertEqual(update_response.data["title"], "Excellent carrots")

        catalog_product = get_or_create_catalog_product_mirror(self.product_a1)
        self.assertEqual(ProductReview.objects.filter(user=self.customer, product=catalog_product).count(), 1)

    def test_rejected_review_does_not_block_customer_from_writing_again(self):
        self._seed_delivered_purchase(self.product_a1)
        catalog_product = get_or_create_catalog_product_mirror(self.product_a1)
        ProductReview.objects.create(
            product=catalog_product,
            user=self.customer,
            reviewer_name="Robert Johnson",
            rating=1,
            title="Removed review",
            comment="This was removed after a report.",
            verified_purchase=True,
            moderation_status=ProductReview.ModerationStatus.REJECTED,
            moderation_reason="Removed after report.",
        )

        eligibility_response = self.client.get(
            f"/api/orders/products/{self.product_a1.id}/reviews/eligibility/"
        )
        self.assertEqual(eligibility_response.status_code, status.HTTP_200_OK)
        self.assertTrue(eligibility_response.data["can_submit"])
        self.assertFalse(eligibility_response.data["has_existing_review"])

        response = self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {"rating": 5, "title": "Fresh replacement", "comment": "This review should be accepted."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["moderation_status"], ProductReview.ModerationStatus.PUBLISHED)

    def test_orders_marketplace_read_routes_are_public(self):
        anonymous_client = APIClient()

        list_response = anonymous_client.get("/api/orders/products/", {"available": "true"})
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(product["id"] == self.product_a1.id for product in list_response.data))

        detail_response = anonymous_client.get(f"/api/orders/products/{self.product_a1.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["id"], self.product_a1.id)

        reviews_response = anonymous_client.get(f"/api/orders/products/{self.product_a1.id}/reviews/")
        self.assertEqual(reviews_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reviews_response.data, [])

    def test_producer_can_update_sub_order_status_with_transition_rules(self):
        ProducerProduct.objects.create(
            producer=self.producer_user_a,
            name=self.product_a1.name,
            description="Producer inventory mirror",
            category=self.product_a1.category,
            unit=self.product_a1.unit,
            price=self.product_a1.price,
            stock_quantity=10,
            availability=ProductAvailability.IN_SEASON,
            season_start_month=1,
            season_end_month=3,
            harvest_date=timezone.localdate(),
        )

        self._add_to_cart(self.product_a1, "2")
        checkout_res = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "45 Park Street, Bristol",
                "customer_postcode": "BS1 5JG",
                "delivery_date": (timezone.localdate() + timedelta(days=2)).isoformat(),
                "payment_method": "test_card",
                "payment_token": "tok_visa",
            },
            format="json",
        )
        self.assertEqual(checkout_res.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=checkout_res.data["order"]["id"])
        sub_order = order.sub_orders.get(producer=self.producer_a)
        producer_product = ProducerProduct.objects.get(
            producer=self.producer_user_a,
            name=self.product_a1.name,
            unit=self.product_a1.unit,
        )
        producer_product.refresh_from_db()
        self.assertEqual(producer_product.stock_quantity, 8)

        producer_client = APIClient()
        producer_client.force_authenticate(self.producer_user_a)

        list_res = producer_client.get("/api/orders/producer/sub-orders/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data[0]["customer_email"], self.customer.email)
        self.assertIn("confirmed", list_res.data[0]["allowed_next_statuses"])

        invalid_res = producer_client.patch(
            f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
            {"status": Order.Status.DELIVERED},
            format="json",
        )
        self.assertEqual(invalid_res.status_code, status.HTTP_400_BAD_REQUEST)

        confirm_res = producer_client.patch(
            f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
            {"status": Order.Status.CONFIRMED, "note": "Accepted for prep."},
            format="json",
        )
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_res.data["status"], Order.Status.CONFIRMED)
        self.assertEqual(confirm_res.data["status_history"][0]["note"], "Accepted for prep.")

        ready_res = producer_client.patch(
            f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
            {"status": Order.Status.READY},
            format="json",
        )
        self.assertEqual(ready_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ready_res.data["status"], Order.Status.READY)

        delivered_res = producer_client.patch(
            f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
            {"status": Order.Status.DELIVERED},
            format="json",
        )
        self.assertEqual(delivered_res.status_code, status.HTTP_200_OK)
        self.assertEqual(delivered_res.data["status"], Order.Status.DELIVERED)

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.DELIVERED)
        self.assertEqual(producer_product.stock_quantity, 8)

        delivered_again_res = producer_client.patch(
            f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
            {"status": Order.Status.DELIVERED},
            format="json",
        )
        self.assertEqual(delivered_again_res.status_code, status.HTTP_200_OK)

        producer_product.refresh_from_db()
        self.assertEqual(producer_product.stock_quantity, 8)
        self.assertEqual(
            ProducerSubOrderStatusHistory.objects.filter(sub_order=sub_order).count(),
            3,
        )
        self.assertTrue(
            UserNotification.objects.filter(
                user=self.customer,
                category="order_status",
                metadata__sub_order_id=sub_order.id,
            ).exists()
        )

    def test_out_of_season_products_are_hidden_and_blocked_from_cart(self):
        today = timezone.localdate()
        future_start = (today.month % 12) + 1
        future_end = ((today.month + 2) % 12) + 1
        seasonal_product = Product.objects.create(
            producer=self.producer_a,
            name="Summer Tomatoes",
            category="Vegetables",
            unit="kg",
            price=Decimal("3.20"),
            stock_quantity=Decimal("25.00"),
            is_available=True,
            in_season=True,
            season_start_month=future_start,
            season_end_month=future_end,
        )

        public_response = self.client.get("/api/orders/products/", {"available": "true"})
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertFalse(any(product["id"] == seasonal_product.id for product in public_response.data))

        add_response = self.client.post(
            "/api/orders/cart/items/",
            {"product_id": seasonal_product.id, "quantity": "1"},
            format="json",
        )
        self.assertEqual(add_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("out of season", str(add_response.data).lower())


class BulkBuyerQuantityCapTests(APITestCase):
    """
    Documents the `BulkBuyerQuantityCapTests` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    def setUp(self):
        self.restaurant_user = User.objects.create_user(
            email="bulk-restaurant@example.com",
            password="StrongPass123!",
            role=User.Role.RESTAURANT,
        )
        self.community_user = User.objects.create_user(
            email="bulk-community@example.com",
            password="StrongPass123!",
            role=User.Role.COMMUNITY,
        )
        producer_user = User.objects.create_user(
            email="bulk-producer@example.com",
            password="StrongPass123!",
            role=User.Role.PRODUCER,
        )
        producer = Producer.objects.create(
            user=producer_user,
            business_name="High Stock Farm",
            postcode="BS1 1AA",
            lead_time_hours=48,
        )
        self.product = Product.objects.create(
            producer=producer,
            name="Bulk Potatoes",
            category="Vegetables",
            unit="kg",
            price=Decimal("1.25"),
            stock_quantity=Decimal("250.00"),
            is_available=True,
        )

    def test_restaurant_can_add_more_than_legacy_cap_when_stock_allows(self):
        client = APIClient()
        client.force_authenticate(self.restaurant_user)

        response = client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product.id, "quantity": "150"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cart_item = Cart.objects.get(customer=self.restaurant_user).items.get(product=self.product)
        self.assertEqual(cart_item.quantity, Decimal("150.00"))

    def test_community_quantity_is_still_limited_by_available_stock(self):
        client = APIClient()
        client.force_authenticate(self.community_user)

        response = client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product.id, "quantity": "300"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Requested quantity exceeds available stock.")
