from __future__ import annotations

from datetime import date, datetime, timedelta
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
from apps.payments.services import get_previous_week_range, process_weekly_settlements

User = get_user_model()


class PaymentsCriticalTestCases(APITestCase):
    def setUp(self):
        self.producer = User.objects.create_user(
            username="producer_settlement",
            email="producer-settlement@example.com",
            password="test-pass-123",
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

    def test_tc_012_weekly_settlement_job_and_history_are_correct(self):
        reference_date = date(2026, 2, 23)  # Monday
        week_range = get_previous_week_range(reference_date)

        delivery_1 = timezone.make_aware(datetime.combine(week_range.start + timedelta(days=1), datetime.min.time()))
        delivery_2 = timezone.make_aware(datetime.combine(week_range.start + timedelta(days=4), datetime.min.time()))
        delivery_outside = timezone.make_aware(
            datetime.combine(week_range.start - timedelta(days=2), datetime.min.time())
        )

        delivered_1 = self._create_order("ORD-SET-1", delivery_1, Decimal("120.00"), status_value=OrderStatus.DELIVERED)
        delivered_2 = self._create_order("ORD-SET-2", delivery_2, Decimal("80.00"), status_value=OrderStatus.DELIVERED)
        pending_order = self._create_order(
            "ORD-SET-3",
            delivery_2,
            Decimal("60.00"),
            status_value=OrderStatus.PENDING,
        )
        _out_of_range = self._create_order(
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
        self.assertEqual(settlement.gross_amount, Decimal("200.00"))
        self.assertEqual(settlement.commission_amount, Decimal("10.00"))
        self.assertEqual(settlement.net_amount, Decimal("190.00"))
        self.assertEqual(settlement.lines.count(), 2)
        self.assertSetEqual(
            {line.order.order_number for line in settlement.lines.all()},
            {"ORD-SET-1", "ORD-SET-2"},
        )

        delivered_1.refresh_from_db()
        delivered_2.refresh_from_db()
        pending_order.refresh_from_db()
        self.assertTrue(delivered_1.settlement_processed)
        self.assertTrue(delivered_2.settlement_processed)
        self.assertFalse(pending_order.settlement_processed)

        self.client.force_authenticate(self.producer)
        list_response = self.client.get("/api/payments/settlements/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["transaction_reference"], settlement.transaction_reference)
        self.assertEqual(Decimal(list_response.data[0]["running_tax_year_total"]), Decimal("190.00"))

        detail_response = self.client.get(f"/api/payments/settlements/{settlement.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail_response.data["lines"]), 2)

        csv_response = self.client.get(f"/api/payments/settlements/{settlement.id}/export/")
        self.assertEqual(csv_response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", csv_response["Content-Type"])
        csv_body = csv_response.content.decode("utf-8")
        self.assertIn("ORD-SET-1", csv_body)
        self.assertIn("ORD-SET-2", csv_body)
        self.assertIn(settlement.transaction_reference, csv_body)
