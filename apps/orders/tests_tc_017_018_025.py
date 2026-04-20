from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.payments.services import StripeCheckoutSessionResult

from .models import (
    Order,
    OrderItem,
    PaymentTransaction,
    Producer,
    ProducerNotification,
    ProducerSubOrder,
    Product,
    RecurringOrderTemplate,
    UserNotification,
)

User = get_user_model()


class CommunityBulkOrderTests(APITestCase):
    def setUp(self):
        self.community_user = User.objects.create_user(
            email="community.bulk@example.com",
            password="StrongPass123!",
            role=User.Role.COMMUNITY,
        )
        producer_users = [
            User.objects.create_user(
                email=f"producer{index}@example.com",
                password="StrongPass123!",
                role=User.Role.PRODUCER,
            )
            for index in range(1, 4)
        ]

        self.producers = [
            Producer.objects.create(
                user=producer_users[0],
                business_name="Bristol Valley Farm",
                contact_email="orders@bristolvalleyfarm.com",
                phone="01179123456",
                postcode="BS1 4DJ",
                lead_time_hours=48,
            ),
            Producer.objects.create(
                user=producer_users[1],
                business_name="Hillside Dairy",
                contact_email="sales@hillsidedairy.com",
                phone="01179001122",
                postcode="BS3 2AA",
                lead_time_hours=48,
            ),
            Producer.objects.create(
                user=producer_users[2],
                business_name="Green Orchard Growers",
                contact_email="team@greenorchard.co.uk",
                phone="01179002233",
                postcode="BS5 9AA",
                lead_time_hours=72,
            ),
        ]
        self.products = [
            Product.objects.create(
                producer=self.producers[0],
                name="Bulk Potatoes",
                unit="kg",
                price=Decimal("1.20"),
                stock_quantity=Decimal("120.00"),
                is_available=True,
            ),
            Product.objects.create(
                producer=self.producers[1],
                name="Bulk Milk",
                unit="litre",
                price=Decimal("1.10"),
                stock_quantity=Decimal("90.00"),
                is_available=True,
            ),
            Product.objects.create(
                producer=self.producers[2],
                name="Bulk Carrots",
                unit="kg",
                price=Decimal("1.50"),
                stock_quantity=Decimal("80.00"),
                is_available=True,
            ),
        ]
        self.client = APIClient()
        self.client.force_authenticate(self.community_user)

    def test_community_user_can_add_to_cart_with_100_item_cap(self):
        within_cap = self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.products[0].id, "quantity": "100"},
            format="json",
        )
        self.assertEqual(within_cap.status_code, status.HTTP_200_OK)

        over_cap = self.client.patch(
            f"/api/orders/cart/items/{within_cap.data['cart']['groups'][0]['items'][0]['cart_item_id']}/",
            {"quantity": "101"},
            format="json",
        )
        self.assertEqual(over_cap.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Maximum quantity per product is 100", over_cap.data["detail"])

    def test_tc017_bulk_order_with_special_instructions_and_contacts(self):
        excessive = self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.products[0].id, "quantity": "101"},
            format="json",
        )
        self.assertEqual(excessive.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Maximum quantity per product is 100", excessive.data["detail"])

        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.products[0].id, "quantity": "50"},
            format="json",
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.products[1].id, "quantity": "30"},
            format="json",
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.products[2].id, "quantity": "20"},
            format="json",
        )

        today = timezone.localdate()
        checkout_res = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "Community Kitchen, 10 Park Street, Bristol",
                "customer_postcode": "BS1 5JG",
                "special_instructions": "Delivery to kitchen entrance, contact kitchen manager",
                "producer_delivery_dates": {
                    str(self.producers[0].id): (today + timedelta(days=3)).isoformat(),
                    str(self.producers[1].id): (today + timedelta(days=3)).isoformat(),
                    str(self.producers[2].id): (today + timedelta(days=4)).isoformat(),
                },
            },
            format="json",
        )
        self.assertEqual(checkout_res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=checkout_res.data["order"]["id"])
        self.assertEqual(order.special_instructions, "Delivery to kitchen entrance, contact kitchen manager")
        self.assertEqual(order.sub_orders.count(), 3)

        first_suborder = checkout_res.data["order"]["sub_orders"][0]
        self.assertIn("producer_contact_phone", first_suborder)
        self.assertIn("producer_contact_email", first_suborder)
        self.assertEqual(first_suborder["notes"], order.special_instructions)

        notifications = ProducerNotification.objects.filter(sub_order__order=order)
        self.assertEqual(notifications.count(), 3)
        self.assertTrue(all("lead time" in n.message for n in notifications))

        confirmation_res = self.client.get(f"/api/community/orders/{order.id}/confirmation/")
        self.assertEqual(confirmation_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(confirmation_res.data["producer_contacts"]), 3)
        self.assertEqual(
            confirmation_res.data["order"]["special_instructions"],
            "Delivery to kitchen entrance, contact kitchen manager",
        )

    @patch("apps.payments.services.create_stripe_checkout_session_for_order")
    def test_community_bulk_checkout_can_prepare_stripe_session(self, mock_checkout_session):
        mock_checkout_session.return_value = StripeCheckoutSessionResult(
            session_id="cs_test_community_bulk",
            checkout_url="https://stripe.test/community",
            publishable_key="pk_test_community",
            test_mode=True,
        )

        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.products[0].id, "quantity": "25"},
            format="json",
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.products[1].id, "quantity": "15"},
            format="json",
        )

        today = timezone.localdate()
        response = self.client.post(
            "/api/community/bulk-checkout/",
            {
                "delivery_address": "Community Hall, 4 Orchard Walk, Bristol",
                "customer_postcode": "BS1 5JG",
                "payment_method": "stripe_checkout",
                "special_instructions": "Use the rear loading entrance",
                "producer_delivery_dates": {
                    str(self.producers[0].id): (today + timedelta(days=3)).isoformat(),
                    str(self.producers[1].id): (today + timedelta(days=3)).isoformat(),
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["payment"]["provider"], "stripe")
        self.assertEqual(response.data["payment"]["checkout_session_id"], "cs_test_community_bulk")
        self.assertEqual(len(response.data["order"]["producer_contacts"]), 2)

        order = Order.objects.get(id=response.data["order"]["id"])
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertTrue(PaymentTransaction.objects.filter(order=order, provider="stripe").exists())


class RestaurantRecurringOrderTests(APITestCase):
    def setUp(self):
        self.restaurant_user = User.objects.create_user(
            email="restaurant@example.com",
            password="StrongPass123!",
            role=User.Role.RESTAURANT,
        )
        producer_users = [
            User.objects.create_user(
                email=f"recurring-producer{index}@example.com",
                password="StrongPass123!",
                role=User.Role.PRODUCER,
            )
            for index in range(1, 3)
        ]
        self.producer_a = Producer.objects.create(
            user=producer_users[0],
            business_name="Farm A",
            contact_email="a@farm.test",
            phone="01170000001",
            postcode="BS1 1AA",
            lead_time_hours=48,
        )
        self.producer_b = Producer.objects.create(
            user=producer_users[1],
            business_name="Farm B",
            contact_email="b@farm.test",
            phone="01170000002",
            postcode="BS2 2BB",
            lead_time_hours=72,
        )
        self.product_a = Product.objects.create(
            producer=self.producer_a,
            name="Tomatoes",
            unit="kg",
            price=Decimal("2.00"),
            stock_quantity=Decimal("120.00"),
            is_available=True,
        )
        self.product_b = Product.objects.create(
            producer=self.producer_b,
            name="Milk",
            unit="litre",
            price=Decimal("1.50"),
            stock_quantity=Decimal("120.00"),
            is_available=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.restaurant_user)

    def test_restaurant_user_can_add_to_cart_with_100_item_cap(self):
        within_cap = self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_a.id, "quantity": "100"},
            format="json",
        )
        self.assertEqual(within_cap.status_code, status.HTTP_200_OK)

        over_cap = self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_b.id, "quantity": "101"},
            format="json",
        )
        self.assertEqual(over_cap.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Maximum quantity per product is 100", over_cap.data["detail"])

    def test_restaurant_recurring_override_rejects_quantity_over_100(self):
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_a.id, "quantity": "10"},
            format="json",
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_b.id, "quantity": "8"},
            format="json",
        )

        today = timezone.localdate()
        create_res = self.client.post(
            "/api/restaurant/recurring-orders/",
            {
                "frequency": "weekly",
                "order_day": 0,
                "delivery_day": 2,
                "delivery_address": "12 Restaurant Lane, Bristol",
                "customer_postcode": "BS1 4DJ",
                "producer_delivery_dates": {
                    str(self.producer_a.id): (today + timedelta(days=3)).isoformat(),
                    str(self.producer_b.id): (today + timedelta(days=4)).isoformat(),
                },
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        template_id = create_res.data["template"]["id"]

        over_cap = self.client.patch(
            f"/api/restaurant/recurring-orders/{template_id}/next-instance/",
            {
                "items": [
                    {"product_id": self.product_a.id, "quantity": "101.00"},
                    {"product_id": self.product_b.id, "quantity": "8.00"},
                ]
            },
            format="json",
        )
        self.assertEqual(over_cap.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Ensure this value is less than or equal to 100.00", str(over_cap.data))

    @patch("apps.payments.services.create_stripe_checkout_session_for_order")
    def test_restaurant_one_off_checkout_can_prepare_stripe_session(self, mock_checkout_session):
        mock_checkout_session.return_value = StripeCheckoutSessionResult(
            session_id="cs_test_restaurant_checkout",
            checkout_url="https://stripe.test/restaurant",
            publishable_key="pk_test_restaurant",
            test_mode=True,
        )

        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_a.id, "quantity": "10"},
            format="json",
        )

        today = timezone.localdate()
        response = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "12 Restaurant Lane, Bristol",
                "customer_postcode": "BS1 4DJ",
                "payment_method": "stripe_checkout",
                "delivery_date": (today + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["payment"]["provider"], "stripe")
        self.assertEqual(response.data["payment"]["checkout_session_id"], "cs_test_restaurant_checkout")

        order = Order.objects.get(id=response.data["order"]["id"])
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertTrue(PaymentTransaction.objects.filter(order=order, provider="stripe").exists())

    @patch("apps.payments.services.create_stripe_checkout_session_for_order")
    def test_restaurant_recurring_creation_can_prepare_stripe_session(self, mock_checkout_session):
        mock_checkout_session.return_value = StripeCheckoutSessionResult(
            session_id="cs_test_restaurant_recurring",
            checkout_url="https://stripe.test/restaurant-recurring",
            publishable_key="pk_test_restaurant",
            test_mode=True,
        )

        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_a.id, "quantity": "10"},
            format="json",
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_b.id, "quantity": "8"},
            format="json",
        )

        today = timezone.localdate()
        response = self.client.post(
            "/api/restaurant/recurring-orders/",
            {
                "frequency": "weekly",
                "order_day": 0,
                "delivery_day": 2,
                "delivery_address": "12 Restaurant Lane, Bristol",
                "customer_postcode": "BS1 4DJ",
                "payment_method": "stripe_checkout",
                "producer_delivery_dates": {
                    str(self.producer_a.id): (today + timedelta(days=3)).isoformat(),
                    str(self.producer_b.id): (today + timedelta(days=4)).isoformat(),
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["payment"]["provider"], "stripe")
        self.assertEqual(response.data["payment"]["checkout_session_id"], "cs_test_restaurant_recurring")
        self.assertIn("template", response.data)

        initial_order = Order.objects.get(id=response.data["initial_order"]["id"])
        self.assertEqual(initial_order.payment_status, Order.PaymentStatus.PENDING)
        self.assertTrue(PaymentTransaction.objects.filter(order=initial_order, provider="stripe").exists())

    @patch("apps.payments.services.create_stripe_checkout_session_for_order")
    def test_restaurant_recurring_creation_respects_selected_cart_items_for_single_producer_checkout(
        self,
        mock_checkout_session,
    ):
        mock_checkout_session.return_value = StripeCheckoutSessionResult(
            session_id="cs_test_restaurant_selected_single",
            checkout_url="https://stripe.test/restaurant-selected-single",
            publishable_key="pk_test_restaurant",
            test_mode=True,
        )

        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_a.id, "quantity": "10"},
            format="json",
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_b.id, "quantity": "8"},
            format="json",
        )

        cart_res = self.client.get("/api/orders/cart/")
        self.assertEqual(cart_res.status_code, status.HTTP_200_OK)
        selected_cart_item_id = None
        for group in cart_res.data["groups"]:
            for item in group["items"]:
                if item["product_id"] == self.product_a.id:
                    selected_cart_item_id = item["cart_item_id"]
                    break
            if selected_cart_item_id is not None:
                break

        self.assertIsNotNone(selected_cart_item_id)

        today = timezone.localdate()
        response = self.client.post(
            "/api/restaurant/recurring-orders/",
            {
                "frequency": "fortnightly",
                "order_day": 2,
                "delivery_day": 0,
                "delivery_address": "12 Restaurant Lane, Bristol",
                "customer_postcode": "BS1 4DJ",
                "payment_method": "stripe_checkout",
                "selected_cart_item_ids": [selected_cart_item_id],
                "delivery_date": (today + timedelta(days=3)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        template = RecurringOrderTemplate.objects.get(id=response.data["template"]["id"])
        self.assertEqual(template.items.count(), 1)
        self.assertEqual(template.items.first().product_id, self.product_a.id)

        initial_order = Order.objects.get(id=response.data["initial_order"]["id"])
        self.assertEqual(initial_order.sub_orders.count(), 1)
        self.assertEqual(initial_order.sub_orders.first().producer_id, self.producer_a.id)
        self.assertTrue(PaymentTransaction.objects.filter(order=initial_order, provider="stripe").exists())

    def test_tc018_create_template_override_and_run_generation(self):
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_a.id, "quantity": "10"},
            format="json",
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.product_b.id, "quantity": "8"},
            format="json",
        )

        today = timezone.localdate()
        create_res = self.client.post(
            "/api/restaurant/recurring-orders/",
            {
                "frequency": "weekly",
                "order_day": 0,
                "delivery_day": 2,
                "delivery_address": "12 Restaurant Lane, Bristol",
                "customer_postcode": "BS1 4DJ",
                "producer_delivery_dates": {
                    str(self.producer_a.id): (today + timedelta(days=3)).isoformat(),
                    str(self.producer_b.id): (today + timedelta(days=4)).isoformat(),
                },
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        template_id = create_res.data["template"]["id"]
        template = RecurringOrderTemplate.objects.get(id=template_id)
        self.assertEqual(template.items.count(), 2)

        patch_res = self.client.patch(
            f"/api/restaurant/recurring-orders/{template_id}/",
            {"next_order_date": today.isoformat()},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        override_res = self.client.patch(
            f"/api/restaurant/recurring-orders/{template_id}/next-instance/",
            {
                "items": [
                    {"product_id": self.product_a.id, "quantity": "15.00"},
                    {"product_id": self.product_b.id, "quantity": "8.00"},
                ]
            },
            format="json",
        )
        self.assertEqual(override_res.status_code, status.HTTP_200_OK)
        template.refresh_from_db()
        template_quantity = template.items.get(product=self.product_a).default_quantity
        self.assertEqual(template_quantity, Decimal("10.00"))

        self.product_b.is_available = False
        self.product_b.save(update_fields=["is_available"])

        run_res = self.client.post("/api/restaurant/recurring-orders/run/", {}, format="json")
        self.assertEqual(run_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(run_res.data["generated_count"], 1)

        generated_order = (
            Order.objects.filter(recurring_template_id=template_id, recurring_scheduled_for=today)
            .exclude(id=create_res.data["initial_order"]["id"])
            .order_by("-id")
            .first()
        )
        self.assertIsNotNone(generated_order)
        self.assertTrue(generated_order.is_recurring_instance)
        self.assertTrue(PaymentTransaction.objects.filter(order=generated_order).exists())

        generated_item = generated_order.items.get(product=self.product_a)
        self.assertEqual(generated_item.quantity, Decimal("15.00"))
        self.assertFalse(generated_order.items.filter(product=self.product_b).exists())
        self.assertTrue(
            UserNotification.objects.filter(
                user=self.restaurant_user, category="recurring_order_generated"
            ).exists()
        )


class AdminCommissionReportTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            email="admin.financial@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.customer_user = User.objects.create_user(
            email="customer.report@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )
        producer_user_a = User.objects.create_user(
            email="producer.report.a@example.com",
            password="StrongPass123!",
            role=User.Role.PRODUCER,
        )
        producer_user_b = User.objects.create_user(
            email="producer.report.b@example.com",
            password="StrongPass123!",
            role=User.Role.PRODUCER,
        )
        self.producer_a = Producer.objects.create(
            user=producer_user_a,
            business_name="Producer A",
            contact_email="a@producer.test",
            phone="01170000003",
            postcode="BS1 1AA",
            lead_time_hours=48,
        )
        self.producer_b = Producer.objects.create(
            user=producer_user_b,
            business_name="Producer B",
            contact_email="b@producer.test",
            phone="01170000004",
            postcode="BS2 2BB",
            lead_time_hours=48,
        )
        self.product_a = Product.objects.create(
            producer=self.producer_a,
            name="Order Product A",
            unit="kg",
            price=Decimal("1.00"),
            stock_quantity=Decimal("1000.00"),
            is_available=True,
        )
        self.product_b = Product.objects.create(
            producer=self.producer_b,
            name="Order Product B",
            unit="kg",
            price=Decimal("1.00"),
            stock_quantity=Decimal("1000.00"),
            is_available=True,
        )
        self._create_reference_orders()

    def _set_order_created_at(self, order: Order, created_at: datetime):
        Order.objects.filter(id=order.id).update(created_at=created_at, updated_at=created_at)

    def _create_reference_orders(self):
        now = timezone.now()

        self.order_100 = Order.objects.create(
            customer=self.customer_user,
            order_number="ORD-COMM-100",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            delivery_address="1 Report Street",
            customer_postcode="BS1 2AA",
            subtotal_amount=Decimal("100.00"),
            commission_rate=Decimal("0.05"),
            commission_amount=Decimal("5.00"),
            total_amount=Decimal("100.00"),
            producer_payout_total=Decimal("95.00"),
            payment_method="test_card",
            payment_reference="PAY-REF-100",
        )
        sub_order_100 = ProducerSubOrder.objects.create(
            order=self.order_100,
            producer=self.producer_a,
            status=Order.Status.DELIVERED,
            delivery_date=timezone.localdate(),
            subtotal_amount=Decimal("100.00"),
            commission_amount=Decimal("5.00"),
            payout_amount=Decimal("95.00"),
        )
        OrderItem.objects.create(
            order=self.order_100,
            sub_order=sub_order_100,
            product=self.product_a,
            product_name="Order Product A",
            producer_name=self.producer_a.business_name,
            unit="kg",
            quantity=Decimal("100.00"),
            unit_price=Decimal("1.00"),
            line_total=Decimal("100.00"),
        )
        PaymentTransaction.objects.create(
            order=self.order_100,
            provider="mock",
            provider_reference="PAY-REF-100",
            amount=Decimal("100.00"),
            status="succeeded",
            test_mode=True,
        )
        self._set_order_created_at(self.order_100, now - timedelta(days=10))

        self.order_150 = Order.objects.create(
            customer=self.customer_user,
            order_number="ORD-COMM-150",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            delivery_address="2 Report Street",
            customer_postcode="BS1 2AA",
            subtotal_amount=Decimal("150.00"),
            commission_rate=Decimal("0.05"),
            commission_amount=Decimal("7.50"),
            total_amount=Decimal("150.00"),
            producer_payout_total=Decimal("142.50"),
            payment_method="test_card",
            payment_reference="PAY-REF-150",
        )
        sub_order_150_a = ProducerSubOrder.objects.create(
            order=self.order_150,
            producer=self.producer_a,
            status=Order.Status.DELIVERED,
            delivery_date=timezone.localdate(),
            subtotal_amount=Decimal("80.00"),
            commission_amount=Decimal("4.00"),
            payout_amount=Decimal("76.00"),
        )
        sub_order_150_b = ProducerSubOrder.objects.create(
            order=self.order_150,
            producer=self.producer_b,
            status=Order.Status.DELIVERED,
            delivery_date=timezone.localdate(),
            subtotal_amount=Decimal("70.00"),
            commission_amount=Decimal("3.50"),
            payout_amount=Decimal("66.50"),
        )
        OrderItem.objects.create(
            order=self.order_150,
            sub_order=sub_order_150_a,
            product=self.product_a,
            product_name="Order Product A",
            producer_name=self.producer_a.business_name,
            unit="kg",
            quantity=Decimal("80.00"),
            unit_price=Decimal("1.00"),
            line_total=Decimal("80.00"),
        )
        OrderItem.objects.create(
            order=self.order_150,
            sub_order=sub_order_150_b,
            product=self.product_b,
            product_name="Order Product B",
            producer_name=self.producer_b.business_name,
            unit="kg",
            quantity=Decimal("70.00"),
            unit_price=Decimal("1.00"),
            line_total=Decimal("70.00"),
        )
        PaymentTransaction.objects.create(
            order=self.order_150,
            provider="mock",
            provider_reference="PAY-REF-150",
            amount=Decimal("150.00"),
            status="succeeded",
            test_mode=True,
        )
        self._set_order_created_at(self.order_150, now - timedelta(days=3))

    def test_tc025_admin_commission_report_and_export(self):
        client = APIClient()
        client.force_authenticate(self.admin_user)

        start_date = (timezone.localdate() - timedelta(days=14)).isoformat()
        end_date = timezone.localdate().isoformat()
        report_res = client.get(
            f"/api/admin/commission-report/?start={start_date}&end={end_date}&status=delivered"
        )
        self.assertEqual(report_res.status_code, status.HTTP_200_OK)
        self.assertEqual(report_res.data["totals"]["number_of_orders"], 2)
        self.assertEqual(report_res.data["totals"]["total_order_value"], "250.00")
        self.assertEqual(report_res.data["totals"]["total_commission"], "12.50")
        self.assertEqual(report_res.data["totals"]["total_producer_payouts"], "237.50")

        detailed_row = next(
            row for row in report_res.data["orders"] if row["order_number"] == "ORD-COMM-150"
        )
        self.assertEqual(detailed_row["commission_amount"], "7.50")
        payouts = {line["producer_name"]: line["payout_amount"] for line in detailed_row["producer_breakdown"]}
        self.assertEqual(payouts["Producer A"], "76.00")
        self.assertEqual(payouts["Producer B"], "66.50")

        detail_res = client.get(f"/api/admin/commission-report/{self.order_150.id}/")
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data["calculation"]["commission_amount"], "7.50")
        self.assertEqual(detail_res.data["payment"]["status"], "succeeded")

        csv_res = client.get(
            f"/api/admin/commission-report/export.csv?start={start_date}&end={end_date}"
        )
        self.assertEqual(csv_res.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", csv_res["Content-Type"])
        csv_text = csv_res.content.decode("utf-8")
        self.assertIn("ORD-COMM-100", csv_text)
        self.assertIn("ORD-COMM-150", csv_text)
        self.assertIn("7.50", csv_text)

        monthly_res = client.get(
            f"/api/admin/commission-report/summary/monthly?year={timezone.now().year}"
        )
        self.assertEqual(monthly_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(monthly_res.data["months"]), 12)

        ytd_res = client.get(
            f"/api/admin/commission-report/summary/ytd?year={timezone.now().year}"
        )
        self.assertEqual(ytd_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ytd_res.data["total_commission"], "12.50")

        customer_client = APIClient()
        customer_client.force_authenticate(self.customer_user)
        forbidden = customer_client.get(
            f"/api/admin/commission-report/?start={start_date}&end={end_date}"
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
