"""
DESD Marketplace documentation.

File role:
    Documents expected behavior through automated tests for this app's public contract.

Domain context:
    Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.orders.models import Order, OrderItem, PaymentTransaction, Producer as OrdersProducer, ProducerSubOrder, Product as OrdersProduct
from apps.producer_portal.models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
    ProductAvailability,
)
from apps.payments.services import get_previous_week_range, process_weekly_settlements

User = get_user_model()


class MockPaymentServiceResponse:
    """
    Documents the `MockPaymentServiceResponse` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
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


class PaymentsCriticalTestCases(APITestCase):
    """
    Documents the `PaymentsCriticalTestCases` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    def setUp(self):
        self.producer = User.objects.create_user(
            email="producer-settlement@example.com",
            password="test-pass-123",
            role="PRODUCER",
        )
        self.customer = User.objects.create_user(
            email="customer-payments@example.com",
            password="test-pass-123",
            role="CUSTOMER",
        )
        self.product = ProducerProduct.objects.create(
            producer=self.producer,
            name="Organic Carrots",
            category="Vegetables",
            description="Sweet carrots",
            price=Decimal("1.80"),
            unit="kg",
            availability=ProductAvailability.YEAR_ROUND,
            stock_quantity=100,
            harvest_date=timezone.localdate(),
        )
        self.orders_producer = OrdersProducer.objects.create(
            user=self.producer,
            business_name="Settlement Farm",
            contact_email=self.producer.email,
            postcode="BS1 1AA",
            lead_time_hours=48,
            is_active=True,
        )
        self.orders_product = OrdersProduct.objects.create(
            producer=self.orders_producer,
            name="Organic Carrots",
            category="Vegetables",
            description="Sweet carrots",
            unit="kg",
            price=Decimal("10.00"),
            stock_quantity=Decimal("100.00"),
            is_available=True,
            in_season=True,
            harvest_date=timezone.localdate(),
            allergen_info="",
        )

    def _create_order(
        self,
        order_number: str,
        delivery_dt: datetime,
        total_value: Decimal,
        status_value: str = OrderStatus.DELIVERED,
    ) -> ProducerOrder:
        order_date = delivery_dt - timedelta(hours=72)
        order = ProducerOrder(
            order_number=order_number,
            producer=self.producer,
            customer_name="Finance Customer",
            customer_email="finance.customer@example.com",
            customer_phone="07700900999",
            delivery_address="11 Settlement Street, Bristol",
            order_date=order_date,
            delivery_date=delivery_dt,
            status=status_value,
            total_value=total_value,
        )
        order.full_clean()
        order.save()
        ProducerOrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            quantity=Decimal("10.00"),
            unit_price=(total_value / Decimal("10.00")).quantize(Decimal("0.01")),
        )
        return order

    def _create_checkout_order(self, order_number: str, total_value: Decimal) -> Order:
        commission_amount = (total_value * Decimal("0.05")).quantize(Decimal("0.01"))
        payout_amount = (total_value - commission_amount).quantize(Decimal("0.01"))
        order = Order.objects.create(
            customer=self.customer,
            order_number=order_number,
            status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PENDING,
            delivery_address="99 Checkout Road, Bristol",
            customer_postcode="BS1 2AB",
            subtotal_amount=total_value,
            commission_rate=Decimal("0.0500"),
            commission_amount=commission_amount,
            total_amount=total_value,
            producer_payout_total=payout_amount,
            payment_method="stripe_checkout",
            payment_reference="",
        )
        sub_order = ProducerSubOrder.objects.create(
            order=order,
            producer=self.orders_producer,
            status=Order.Status.PENDING,
            delivery_date=timezone.localdate() + timedelta(days=2),
            subtotal_amount=total_value,
            commission_amount=commission_amount,
            payout_amount=payout_amount,
        )
        OrderItem.objects.create(
            order=order,
            sub_order=sub_order,
            product=self.orders_product,
            product_name=self.orders_product.name,
            producer_name=self.orders_producer.business_name,
            unit=self.orders_product.unit,
            quantity=Decimal("2.00"),
            unit_price=(total_value / Decimal("2.00")).quantize(Decimal("0.01")),
            line_total=total_value,
        )
        return order

    @staticmethod
    def _stripe_signature(payload: str, secret: str) -> str:
        timestamp = int(time.time())
        signed_payload = f"{timestamp}.{payload}".encode("utf-8")
        digest = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
        return f"t={timestamp},v1={digest}"

    @patch("apps.payments.services.requests.post")
    def test_backend_creates_stripe_checkout_session_in_test_mode(self, mock_post):
        order = self._create_checkout_order("ORD-STRIPE-SESSION-1", Decimal("20.00"))
        mock_post.return_value = MockPaymentServiceResponse(
            201,
            {
                "id": "cs_test_123",
                "url": "https://checkout.stripe.com/c/pay/cs_test_123",
                "livemode": False,
                "publishable_key": "pk_test_checkout_key",
            },
        )

        self.client.force_authenticate(self.customer)
        response_ = self.client.post(
            "/api/payments/stripe/checkout-session/",
            {"order_id": order.id},
            format="json",
        )

        self.assertEqual(response_.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_.data["checkout_session_id"], "cs_test_123")
        self.assertEqual(response_.data["publishable_key"], "pk_test_checkout_key")
        self.assertTrue(response_.data["test_mode"])
        self.assertTrue(mock_post.called)
        self.assertEqual(mock_post.call_args.kwargs["json"]["client_reference_id"], str(order.id))

        order.refresh_from_db()
        transaction_record = PaymentTransaction.objects.get(order=order)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertEqual(order.payment_method, "stripe_checkout")
        self.assertEqual(transaction_record.provider, "stripe")
        self.assertEqual(transaction_record.provider_reference, "cs_test_123")
        self.assertEqual(transaction_record.status, "pending")
        self.assertTrue(transaction_record.test_mode)
        self.assertEqual(transaction_record.raw_payload["checkout_url"], "https://checkout.stripe.com/c/pay/cs_test_123")

    @patch("apps.payments.services.requests.post")
    def test_checkout_session_uses_request_redirect_urls(self, mock_post):
        order = self._create_checkout_order("ORD-STRIPE-DYNAMIC-URL", Decimal("20.00"))
        mock_post.return_value = MockPaymentServiceResponse(
            201,
            {
                "id": "cs_test_dynamic_url",
                "url": "https://checkout.stripe.com/c/pay/cs_test_dynamic_url",
                "livemode": False,
                "publishable_key": "pk_test_checkout_key",
            },
        )

        self.client.force_authenticate(self.customer)
        response_ = self.client.post(
            "/api/payments/stripe/checkout-session/",
            {
                "order_id": order.id,
                "success_url": "https://market.example.test/checkout/success?session_id={CHECKOUT_SESSION_ID}",
                "cancel_url": "https://market.example.test/checkout/cancel",
            },
            format="json",
        )

        self.assertEqual(response_.status_code, status.HTTP_201_CREATED)
        stripe_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(
            stripe_payload["success_url"],
            "https://market.example.test/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        )
        self.assertEqual(stripe_payload["cancel_url"], "https://market.example.test/checkout/cancel")

    @patch("apps.payments.services.requests.post")
    def test_live_stripe_keys_are_rejected(self, mock_post):
        order = self._create_checkout_order("ORD-STRIPE-LIVE-REJECT", Decimal("20.00"))
        mock_post.return_value = MockPaymentServiceResponse(
            400,
            {"detail": "Live Stripe keys are not allowed. Use Stripe test keys only."},
        )

        self.client.force_authenticate(self.customer)
        response_ = self.client.post(
            "/api/payments/stripe/checkout-session/",
            {"order_id": order.id},
            format="json",
        )

        self.assertEqual(response_.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Live Stripe keys are not allowed", response_.data["detail"])

    @patch("apps.payments.services.requests.post")
    def test_stripe_webhook_marks_payment_paid_idempotently(self, mock_post):
        order = self._create_checkout_order("ORD-STRIPE-WEBHOOK-1", Decimal("20.00"))
        PaymentTransaction.objects.create(
            order=order,
            provider="stripe",
            provider_reference="cs_test_paid_123",
            amount=order.total_amount,
            status="pending",
            test_mode=True,
            raw_payload={"processed_event_ids": []},
        )

        event_payload = {
            "id": "evt_test_webhook_123",
            "type": "checkout.session.completed",
            "livemode": False,
            "data": {
                "object": {
                    "id": "cs_test_paid_123",
                    "client_reference_id": str(order.id),
                    "payment_intent": "pi_test_paid_123",
                    "metadata": {"order_id": str(order.id), "order_number": order.order_number},
                }
            },
        }
        payload_json = json.dumps(event_payload, separators=(",", ":"))
        signature = self._stripe_signature(payload_json, "whsec_test_webhook_key")
        mock_post.return_value = MockPaymentServiceResponse(
            200,
            {"event": event_payload},
        )

        response_ = self.client.post(
            "/api/payments/stripe/webhook/",
            data=payload_json,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=signature,
        )
        self.assertEqual(response_.status_code, status.HTTP_200_OK)
        self.assertTrue(response_.data["handled"])
        self.assertFalse(response_.data["duplicate"])

        order.refresh_from_db()
        transaction_record = PaymentTransaction.objects.get(order=order)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.payment_reference, "pi_test_paid_123")
        self.assertEqual(transaction_record.status, "succeeded")
        self.assertEqual(transaction_record.raw_payload["processed_event_ids"], ["evt_test_webhook_123"])

        duplicate_response = self.client.post(
            "/api/payments/stripe/webhook/",
            data=payload_json,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=signature,
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_200_OK)
        self.assertTrue(duplicate_response.data["handled"])
        self.assertTrue(duplicate_response.data["duplicate"])

        order.refresh_from_db()
        transaction_record.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(transaction_record.status, "succeeded")
        self.assertEqual(transaction_record.raw_payload["processed_event_ids"], ["evt_test_webhook_123"])

    @patch("apps.payments.services.requests.post")
    def test_confirming_stripe_checkout_marks_order_paid_and_reduces_both_stock_records(self, mock_post):
        self.product.stock_quantity = 5
        self.product.save(update_fields=["stock_quantity", "updated_at"])
        self.orders_product.stock_quantity = Decimal("5.00")
        self.orders_product.save(update_fields=["stock_quantity", "updated_at"])

        def payment_service_side_effect(url, json=None, headers=None, timeout=None):
            if url.endswith("/stripe/checkout-sessions"):
                return MockPaymentServiceResponse(
                    201,
                    {
                        "id": "cs_test_live_checkout_5",
                        "url": "https://checkout.stripe.com/c/pay/cs_test_live_checkout_5",
                        "livemode": False,
                        "publishable_key": "pk_test_checkout_key",
                    },
                )
            if url.endswith("/stripe/checkout-sessions/retrieve"):
                return MockPaymentServiceResponse(
                    200,
                    {
                        "id": "cs_test_live_checkout_5",
                        "payment_status": "paid",
                        "status": "complete",
                        "payment_intent": "pi_test_live_checkout_5",
                        "livemode": False,
                    },
                )
            raise AssertionError(f"Unexpected payment service request: {url}")

        mock_post.side_effect = payment_service_side_effect

        self.client.force_authenticate(self.customer)
        add_response = self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.orders_product.id, "quantity": "5"},
            format="json",
        )
        self.assertEqual(add_response.status_code, status.HTTP_200_OK)

        checkout_response = self.client.post(
            "/api/orders/checkout/",
            {
                "delivery_address": "99 Checkout Road, Bristol",
                "customer_postcode": "BS1 2AB",
                "delivery_date": (timezone.localdate() + timedelta(days=2)).isoformat(),
                "payment_method": "stripe_checkout",
            },
            format="json",
        )
        self.assertEqual(checkout_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(checkout_response.data["payment"]["checkout_session_id"], "cs_test_live_checkout_5")

        order = Order.objects.get(id=checkout_response.data["order"]["id"])
        transaction_record = PaymentTransaction.objects.get(order=order)
        self.orders_product.refresh_from_db()
        self.product.refresh_from_db()

        self.assertEqual(order.payment_status, Order.PaymentStatus.PENDING)
        self.assertEqual(self.orders_product.stock_quantity, Decimal("0.00"))
        self.assertFalse(self.orders_product.is_available)
        self.assertEqual(self.product.stock_quantity, 0)
        self.assertTrue(transaction_record.raw_payload["stock_reserved"])

        confirm_response = self.client.post(
            "/api/payments/stripe/checkout-session/confirm/",
            {"session_id": "cs_test_live_checkout_5"},
            format="json",
        )
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.assertTrue(confirm_response.data["confirmed"])
        self.assertEqual(confirm_response.data["order"]["payment_reference"], "pi_t***t_5")
        self.assertEqual(confirm_response.data["order"]["payment_reference_masked"], "pi_t***t_5")

        order.refresh_from_db()
        transaction_record.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.payment_reference, "pi_test_live_checkout_5")
        self.assertEqual(transaction_record.status, "succeeded")

        cart_response = self.client.get("/api/orders/cart/")
        self.assertEqual(cart_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_response.data["producer_count"], 0)

        sold_out_response = self.client.post(
            "/api/orders/cart/items/",
            {"product_id": self.orders_product.id, "quantity": "1"},
            format="json",
        )
        self.assertEqual(sold_out_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Product is unavailable", sold_out_response.data["detail"])

        available_products_response = self.client.get("/api/orders/products/?available=true")
        self.assertEqual(available_products_response.status_code, status.HTTP_200_OK)
        self.assertFalse(any(product["id"] == self.orders_product.id for product in available_products_response.data))

    def test_tc_012_weekly_settlement_job_and_history_are_correct(self):
        reference_date = date(2026, 2, 23)
        week_range = get_previous_week_range(reference_date)

        delivery_1 = timezone.make_aware(datetime.combine(week_range.start + timedelta(days=1), datetime.min.time()))
        delivery_2 = timezone.make_aware(datetime.combine(week_range.start + timedelta(days=4), datetime.min.time()))
        delivery_outside = timezone.make_aware(
            datetime.combine(week_range.start - timedelta(days=2), datetime.min.time())
        )

        delivered_1 = self._create_order("ORD-SET-1", delivery_1, Decimal("120.00"), status_value=OrderStatus.DELIVERED)
        delivered_2 = self._create_order("ORD-SET-2", delivery_2, Decimal("80.00"), status_value=OrderStatus.DELIVERED)
        marketplace_order = self._create_checkout_order("ORD-MARKET-SET-1", Decimal("40.00"))
        marketplace_order.status = Order.Status.DELIVERED
        marketplace_order.payment_status = Order.PaymentStatus.PAID
        marketplace_order.created_at = delivery_1
        marketplace_order.save(update_fields=["status", "payment_status", "created_at", "updated_at"])
        marketplace_sub_order = marketplace_order.sub_orders.get()
        marketplace_sub_order.status = Order.Status.DELIVERED
        marketplace_sub_order.delivery_date = week_range.start + timedelta(days=2)
        marketplace_sub_order.save(update_fields=["status", "delivery_date", "updated_at"])
        pending_order = self._create_order(
            "ORD-SET-3",
            delivery_2,
            Decimal("60.00"),
            status_value=OrderStatus.PENDING,
        )
        self._create_order(
            "ORD-SET-4",
            delivery_outside,
            Decimal("50.00"),
            status_value=OrderStatus.DELIVERED,
        )

        settlements = process_weekly_settlements(reference_date=reference_date)
        self.assertEqual(len(settlements), 1)

        settlement = settlements[0]
        self.assertEqual(settlement.week_start, week_range.start)
        self.assertEqual(settlement.week_end, week_range.end)
        self.assertEqual(settlement.gross_amount, Decimal("240.00"))
        self.assertEqual(settlement.commission_amount, Decimal("12.00"))
        self.assertEqual(settlement.net_amount, Decimal("228.00"))
        self.assertEqual(settlement.lines.count(), 3)
        self.assertSetEqual(
            {line.order.order_number for line in settlement.lines.filter(order__isnull=False)},
            {"ORD-SET-1", "ORD-SET-2"},
        )
        self.assertTrue(settlement.lines.filter(sub_order=marketplace_sub_order).exists())

        delivered_1.refresh_from_db()
        delivered_2.refresh_from_db()
        pending_order.refresh_from_db()
        marketplace_sub_order.refresh_from_db()
        self.assertTrue(delivered_1.settlement_processed)
        self.assertTrue(delivered_2.settlement_processed)
        self.assertFalse(pending_order.settlement_processed)
        self.assertTrue(marketplace_sub_order.settlement_processed)

        self.client.force_authenticate(self.producer)
        list_response = self.client.get("/api/payments/settlements/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["transaction_reference"], settlement.transaction_reference)
        self.assertEqual(Decimal(list_response.data[0]["running_tax_year_total"]), Decimal("228.00"))
        self.assertEqual(Decimal(list_response.data[0]["commission_amount"]), Decimal("12.00"))
        self.assertEqual(Decimal(list_response.data[0]["net_amount"]), Decimal("228.00"))

        detail_response = self.client.get(f"/api/payments/settlements/{settlement.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail_response.data["lines"]), 3)
        marketplace_line = next(line for line in detail_response.data["lines"] if line["sub_order_id"] == marketplace_sub_order.id)
        self.assertEqual(marketplace_line["source_type"], "marketplace")
        self.assertEqual(marketplace_line["order_number"], marketplace_order.order_number)

        csv_response = self.client.get(f"/api/payments/settlements/{settlement.id}/export/")
        self.assertEqual(csv_response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", csv_response["Content-Type"])
        csv_body = csv_response.content.decode("utf-8")
        self.assertIn("ORD-SET-1", csv_body)
        self.assertIn("ORD-SET-2", csv_body)
        self.assertIn(marketplace_order.order_number, csv_body)
        self.assertIn(settlement.transaction_reference, csv_body)

        pdf_response = self.client.get(f"/api/payments/settlements/{settlement.id}/export/?format=pdf")
        self.assertEqual(pdf_response.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", pdf_response["Content-Type"])
        self.assertTrue(pdf_response.content.startswith(b"%PDF"))

        xlsx_response = self.client.get(f"/api/payments/settlements/{settlement.id}/export/?format=xlsx")
        self.assertEqual(xlsx_response.status_code, status.HTTP_200_OK)
        self.assertIn("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx_response["Content-Type"])
        self.assertTrue(xlsx_response.content.startswith(b"PK"))
