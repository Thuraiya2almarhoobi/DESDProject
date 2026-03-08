from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.producer_portal.models import ProducerProduct, ProductAvailability

from .models import Cart, CustomerProfile, Order, Producer, Product


User = get_user_model()


class OrdersCriticalFlowTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(username="customer_tc", password="pass1234")
        self.producer_user_a = User.objects.create_user(username="producer_a", password="pass1234")
        self.producer_user_b = User.objects.create_user(username="producer_b", password="pass1234")

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

    def _add_to_cart(self, product: Product, quantity: str):
        return self.client.post(
            "/api/orders/cart/items/",
            {"product_id": product.id, "quantity": quantity},
            format="json",
        )

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
        self.assertEqual(order.sub_orders.first().producer, self.producer_a)

        cart = Cart.objects.get(customer=self.customer)
        self.assertEqual(cart.items.count(), 0)

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
        producer_product = ProducerProduct.objects.get(
            producer=self.producer_user_a,
            name=self.product_a1.name,
            unit=self.product_a1.unit,
        )
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


