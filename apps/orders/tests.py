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
from .models import Cart, CustomerProfile, Order, OrderItem, Producer, ProducerSubOrder, Product


User = get_user_model()


class MockPaymentServiceResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


class OrdersCriticalFlowTests(APITestCase):
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

    def _add_to_cart(self, product: Product, quantity: str):
        return self.client.post(
            "/api/orders/cart/items/",
            {"product_id": product.id, "quantity": quantity},
            format="json",
        )

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
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertEqual(order.sub_orders.count(), 1)

        expected_subtotal = Decimal("2.50") * Decimal("2.00") + Decimal("3.00") * Decimal("1.00")
        self.assertEqual(order.subtotal_amount, expected_subtotal.quantize(Decimal("0.01")))
        self.assertEqual(order.commission_amount, (expected_subtotal * Decimal("0.05")).quantize(Decimal("0.01")))
        self.assertEqual(order.payment.provider, "stripe")
        self.assertEqual(order.payment.status, "pending")
        self.assertEqual(order.sub_orders.first().producer, self.producer_a)
        self.assertEqual(order.payment.provider_reference, f"cs_test_order_{order_id}")

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
        self.assertEqual(cart.items.count(), 2)

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

    def test_suspicious_review_is_held_for_moderation_and_hidden_from_public_list(self):
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
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["moderation_status"], "pending")
        self.assertIn("approval", response.data["moderation_reason"].lower())

        reviews_response = self.client.get(f"/api/orders/products/{self.product_a1.id}/reviews/")
        self.assertEqual(reviews_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reviews_response.data, [])

    def test_admin_can_publish_review_and_verified_label_depends_on_order_history(self):
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
        self.assertEqual(review_response.status_code, status.HTTP_202_ACCEPTED)
        review_id = review_response.data["id"]
        self.assertTrue(review_response.data["verified_purchase"])

        admin_user = User.objects.create_user(
            email="admin-review@example.com",
            password="pass1234",
            role=User.Role.ADMIN,
        )
        admin_client = APIClient()
        admin_client.force_authenticate(admin_user)
        moderation_response = admin_client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/{review_id}/moderate/",
            {"moderation_status": "published", "moderation_reason": "Approved"},
            format="json",
        )
        self.assertEqual(moderation_response.status_code, status.HTTP_200_OK)
        self.assertEqual(moderation_response.data["moderation_status"], "published")
        self.assertTrue(moderation_response.data["verified_purchase"])

        reviews_response = self.client.get(f"/api/orders/products/{self.product_a1.id}/reviews/")
        self.assertEqual(reviews_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(reviews_response.data), 1)
        self.assertTrue(reviews_response.data[0]["verified_purchase"])

    def test_admin_moderation_queue_shows_current_purchase_label_for_pending_reviews(self):
        self._seed_delivered_purchase(self.product_a1)
        self.client.post(
            f"/api/orders/products/{self.product_a1.id}/reviews/",
            {
                "rating": 4,
                "title": "Pending until approval",
                "comment": "BUY NOW!!! Visit https://spam.example for my full review!!!!!!",
            },
            format="json",
        )

        admin_user = User.objects.create_user(
            email="admin-queue@example.com",
            password="pass1234",
            role=User.Role.ADMIN,
        )
        admin_client = APIClient()
        admin_client.force_authenticate(admin_user)
        queue_response = admin_client.get("/api/orders/reviews/moderation-queue/")

        self.assertEqual(queue_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(queue_response.data), 1)
        self.assertEqual(queue_response.data[0]["product_name"], self.product_a1.name)
        self.assertTrue(queue_response.data[0]["has_verified_purchase"])
        self.assertEqual(queue_response.data[0]["purchase_label"], "Verified purchase")

    def test_non_admin_cannot_access_review_moderation_queue(self):
        response = self.client.get("/api/orders/reviews/moderation-queue/")
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
            {"status": Order.Status.CONFIRMED},
            format="json",
        )
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_res.data["status"], Order.Status.CONFIRMED)

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
