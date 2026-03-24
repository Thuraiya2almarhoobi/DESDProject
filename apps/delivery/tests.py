from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import Address, CustomerProfile as EditableCustomerProfile, ProducerProfile
from apps.orders.models import Order, OrderItem, Producer, ProducerSubOrder, Product

from .models import DeliveryEvent, DeliveryJob
from .services import restart_delivery_job_simulation, sync_delivery_job_simulation

User = get_user_model()


@override_settings(
    STUART_SERVICE_BASE_URL="http://stuart:8020",
    STUART_SERVICE_SHARED_SECRET="stuart-service-secret",
    STUART_WEBHOOK_SECRET="stuart-webhook-secret",
)
class StuartDeliveryIntegrationTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email="customer-delivery@example.com",
            password="pass1234",
            role=User.Role.CUSTOMER,
        )
        self.producer_user = User.objects.create_user(
            email="producer-delivery@example.com",
            password="pass1234",
            role=User.Role.PRODUCER,
        )
        self.other_producer_user = User.objects.create_user(
            email="producer-other@example.com",
            password="pass1234",
            role=User.Role.PRODUCER,
        )

        self.customer_address = Address.objects.create(
            user=self.customer,
            label="Delivery Address",
            line1="45 Park Street",
            city="Bristol",
            postcode="BS1 5JG",
            is_default=True,
        )
        EditableCustomerProfile.objects.create(
            user=self.customer,
            full_name="Robert Johnson",
            phone="07123456789",
            default_address=self.customer_address,
        )

        self.producer_address = Address.objects.create(
            user=self.producer_user,
            label="Business Address",
            line1="Unit 5 Farm Lane",
            city="Bristol",
            postcode="BS1 4DJ",
            is_default=True,
        )
        ProducerProfile.objects.create(
            user=self.producer_user,
            business_name="Bristol Valley Farm",
            contact_name="Amelia Grower",
            phone="07000000001",
            address=self.producer_address,
        )

        self.producer = Producer.objects.create(
            user=self.producer_user,
            business_name="Bristol Valley Farm",
            postcode="BS1 4DJ",
            lead_time_hours=48,
        )
        self.other_producer = Producer.objects.create(
            user=self.other_producer_user,
            business_name="Hillside Dairy",
            postcode="BS3 2AA",
            lead_time_hours=48,
        )

        self.product = Product.objects.create(
            producer=self.producer,
            name="Organic Carrots",
            category="Vegetables",
            unit="kg",
            price=Decimal("2.50"),
            stock_quantity=Decimal("20.00"),
            is_available=True,
        )
        self.other_product = Product.objects.create(
            producer=self.other_producer,
            name="Fresh Milk",
            category="Dairy",
            unit="litre",
            price=Decimal("1.80"),
            stock_quantity=Decimal("15.00"),
            is_available=True,
        )

        self.delivery_requests: list[dict] = []
        self.delivery_patcher = patch(
            "apps.delivery.services._service_request",
            side_effect=self._mock_delivery_service_request,
        )
        self.delivery_patcher.start()
        self.addCleanup(self.delivery_patcher.stop)

        self.producer_client = APIClient()
        self.producer_client.force_authenticate(self.producer_user)
        self.customer_client = APIClient()
        self.customer_client.force_authenticate(self.customer)

    def _build_order(self, *, sub_order_status: str = Order.Status.CONFIRMED) -> tuple[Order, ProducerSubOrder]:
        order = Order.objects.create(
            customer=self.customer,
            order_number=f"ORD-DEL-{timezone.now().strftime('%H%M%S%f')}",
            status=sub_order_status,
            payment_status=Order.PaymentStatus.PAID,
            delivery_address="45 Park Street, Bristol",
            customer_postcode="BS1 5JG",
            special_instructions="Leave at front desk",
            subtotal_amount=Decimal("5.00"),
            commission_rate=Decimal("0.05"),
            commission_amount=Decimal("0.25"),
            total_amount=Decimal("5.25"),
            producer_payout_total=Decimal("4.75"),
            payment_method="stripe_checkout",
            payment_reference="pi_test_delivery_123",
        )
        sub_order = ProducerSubOrder.objects.create(
            order=order,
            producer=self.producer,
            status=sub_order_status,
            delivery_date=timezone.localdate() + timedelta(days=2),
            subtotal_amount=Decimal("5.00"),
            commission_amount=Decimal("0.25"),
            payout_amount=Decimal("4.75"),
            notes="Dispatch with sandbox courier",
        )
        OrderItem.objects.create(
            order=order,
            sub_order=sub_order,
            product=self.product,
            product_name=self.product.name,
            producer_name=self.producer.business_name,
            unit=self.product.unit,
            quantity=Decimal("2.00"),
            unit_price=self.product.price,
            line_total=Decimal("5.00"),
        )
        return order, sub_order

    def _build_multi_producer_order(self) -> tuple[Order, ProducerSubOrder, ProducerSubOrder]:
        order = Order.objects.create(
            customer=self.customer,
            order_number=f"ORD-MULTI-{timezone.now().strftime('%H%M%S%f')}",
            status=Order.Status.CONFIRMED,
            payment_status=Order.PaymentStatus.PAID,
            delivery_address="45 Park Street, Bristol",
            customer_postcode="BS1 5JG",
            special_instructions="Ring the buzzer",
            subtotal_amount=Decimal("6.80"),
            commission_rate=Decimal("0.05"),
            commission_amount=Decimal("0.34"),
            total_amount=Decimal("7.14"),
            producer_payout_total=Decimal("6.46"),
            payment_method="stripe_checkout",
            payment_reference="pi_test_multi_456",
        )
        sub_order_a = ProducerSubOrder.objects.create(
            order=order,
            producer=self.producer,
            status=Order.Status.CONFIRMED,
            delivery_date=timezone.localdate() + timedelta(days=2),
            subtotal_amount=Decimal("5.00"),
            commission_amount=Decimal("0.25"),
            payout_amount=Decimal("4.75"),
        )
        sub_order_b = ProducerSubOrder.objects.create(
            order=order,
            producer=self.other_producer,
            status=Order.Status.CONFIRMED,
            delivery_date=timezone.localdate() + timedelta(days=3),
            subtotal_amount=Decimal("1.80"),
            commission_amount=Decimal("0.09"),
            payout_amount=Decimal("1.71"),
        )
        OrderItem.objects.create(
            order=order,
            sub_order=sub_order_a,
            product=self.product,
            product_name=self.product.name,
            producer_name=self.producer.business_name,
            unit=self.product.unit,
            quantity=Decimal("2.00"),
            unit_price=self.product.price,
            line_total=Decimal("5.00"),
        )
        OrderItem.objects.create(
            order=order,
            sub_order=sub_order_b,
            product=self.other_product,
            product_name=self.other_product.name,
            producer_name=self.other_producer.business_name,
            unit=self.other_product.unit,
            quantity=Decimal("1.00"),
            unit_price=self.other_product.price,
            line_total=Decimal("1.80"),
        )
        return order, sub_order_a, sub_order_b

    def _mock_delivery_service_request(self, path, payload):
        self.delivery_requests.append({"path": path, "payload": payload})
        client_reference = str((payload or {}).get("client_reference") or "")
        if path == "/stuart/jobs":
            return {
                "job_id": f"job_{client_reference or 'delivery'}",
                "package_id": f"pkg_{client_reference or 'delivery'}",
                "client_reference": client_reference,
                "status": "created",
                "tracking_url": f"https://tracking.stuart.test/{client_reference or 'delivery'}",
                "client_tracking_url": f"https://client.stuart.test/{client_reference or 'delivery'}",
                "eta_to_dropoff": (timezone.now() + timedelta(minutes=55)).isoformat(),
                "courier_name": "Sandbox Courier",
                "courier_transport_type": "bike",
                "test_mode": True,
            }
        if path == "/stuart/jobs/retrieve":
            return {
                "job_id": str((payload or {}).get("job_id") or ""),
                "package_id": str((payload or {}).get("package_id") or ""),
                "client_reference": client_reference,
                "status": "delivering",
                "tracking_url": f"https://tracking.stuart.test/{client_reference or 'delivery'}",
                "client_tracking_url": f"https://client.stuart.test/{client_reference or 'delivery'}",
                "eta_to_dropoff": (timezone.now() + timedelta(minutes=25)).isoformat(),
                "courier_name": "Refresh Courier",
                "courier_transport_type": "bike",
                "test_mode": True,
            }
        if path == "/stuart/jobs/cancel":
            return {
                "job_id": str((payload or {}).get("job_id") or ""),
                "package_id": str((payload or {}).get("package_id") or ""),
                "client_reference": client_reference,
                "status": "cancelled",
                "test_mode": True,
            }
        raise AssertionError(f"Unexpected Stuart delivery service request: {path}")

    def test_ready_transition_creates_stuart_delivery_job_from_saved_addresses(self):
        order, sub_order = self._build_order(sub_order_status=Order.Status.CONFIRMED)

        response = self.producer_client.patch(
            f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
            {"status": Order.Status.READY},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sub_order.refresh_from_db()
        self.assertEqual(sub_order.status, Order.Status.READY)
        delivery_job = DeliveryJob.objects.get(sub_order=sub_order)
        self.assertEqual(delivery_job.provider_reference, f"job_suborder:{sub_order.id}")
        self.assertEqual(delivery_job.client_reference, f"suborder:{sub_order.id}")
        self.assertEqual(delivery_job.pickup_address_snapshot["full_address"], "Unit 5 Farm Lane, Bristol, BS1 4DJ")
        self.assertEqual(delivery_job.dropoff_address_snapshot["full_address"], "45 Park Street, Bristol, BS1 5JG")
        self.assertIn("coordinates", delivery_job.pickup_address_snapshot)
        self.assertIn("coordinates", delivery_job.dropoff_address_snapshot)
        self.assertIsNotNone(delivery_job.simulation_started_at)
        self.assertGreater(delivery_job.simulation_duration_seconds, 0)
        self.assertEqual(response.data["delivery"]["status"], DeliveryJob.Status.ASSIGNED)
        self.assertEqual(self.delivery_requests[0]["payload"]["pickup"]["address"], "Unit 5 Farm Lane, Bristol, BS1 4DJ")
        self.assertEqual(self.delivery_requests[0]["payload"]["dropoff"]["address"], "45 Park Street, Bristol, BS1 5JG")
        self.assertEqual(order.customer.email, self.delivery_requests[0]["payload"]["metadata"]["customer_email"])

    def test_ready_transition_failure_keeps_sub_order_confirmed(self):
        order, sub_order = self._build_order(sub_order_status=Order.Status.CONFIRMED)

        with patch(
            "apps.delivery.services._service_request",
            side_effect=ValueError("Sandbox dispatch rejected."),
        ):
            response = self.producer_client.patch(
                f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
                {"status": Order.Status.READY},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Sandbox dispatch rejected.")
        sub_order.refresh_from_db()
        self.assertEqual(sub_order.status, Order.Status.CONFIRMED)
        self.assertFalse(DeliveryJob.objects.filter(sub_order=sub_order).exists())
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CONFIRMED)

    def test_delivery_refresh_and_cancel_actions_update_delivery_job(self):
        _, sub_order = self._build_order(sub_order_status=Order.Status.READY)
        delivery_job = DeliveryJob.objects.create(
            sub_order=sub_order,
            provider=DeliveryJob.Provider.STUART,
            provider_reference="job_suborder:refresh",
            package_reference="pkg_suborder:refresh",
            client_reference=f"suborder:{sub_order.id}",
            status=DeliveryJob.Status.CREATED,
            tracking_url="https://tracking.stuart.test/original",
            client_tracking_url="https://client.stuart.test/original",
            pickup_address_snapshot={"full_address": "Unit 5 Farm Lane, Bristol, BS1 4DJ"},
            dropoff_address_snapshot={"full_address": "45 Park Street, Bristol, BS1 5JG"},
            raw_payload={"seeded": True},
        )

        refresh_res = self.producer_client.post(
            f"/api/delivery/producer/sub-orders/{sub_order.id}/delivery/refresh/",
        )
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        delivery_job.refresh_from_db()
        self.assertEqual(delivery_job.status, DeliveryJob.Status.DELIVERING)
        self.assertEqual(delivery_job.courier_name, "Refresh Courier")

        cancel_res = self.producer_client.post(
            f"/api/delivery/producer/sub-orders/{sub_order.id}/delivery/cancel/",
        )
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        delivery_job.refresh_from_db()
        self.assertEqual(delivery_job.status, DeliveryJob.Status.CANCELLED)

    def test_simulation_sync_advances_statuses_and_marks_delivery_complete(self):
        order, sub_order = self._build_order(sub_order_status=Order.Status.READY)
        start_time = timezone.now() - timedelta(seconds=120)
        delivery_job = DeliveryJob.objects.create(
            sub_order=sub_order,
            provider=DeliveryJob.Provider.STUART,
            provider_reference="job_suborder:sim",
            package_reference="pkg_suborder:sim",
            client_reference=f"suborder:{sub_order.id}",
            status=DeliveryJob.Status.ASSIGNED,
            tracking_url="https://tracking.stuart.test/sim",
            client_tracking_url="https://client.stuart.test/sim",
            pickup_address_snapshot={
                "full_address": "Unit 5 Farm Lane, Bristol, BS1 4DJ",
                "postcode": "BS1 4DJ",
                "coordinates": {"lat": 51.4510, "lng": -2.5904},
            },
            dropoff_address_snapshot={
                "full_address": "45 Park Street, Bristol, BS1 5JG",
                "postcode": "BS1 5JG",
                "coordinates": {"lat": 51.4545, "lng": -2.5879},
            },
            test_mode=True,
            simulation_started_at=start_time,
            simulation_duration_seconds=300,
        )

        midway = sync_delivery_job_simulation(delivery_job, now=start_time + timedelta(seconds=210))
        self.assertEqual(midway.status, DeliveryJob.Status.DELIVERING)
        self.assertIsNotNone(midway.last_courier_latitude)
        self.assertIsNotNone(midway.last_courier_longitude)

        completed = sync_delivery_job_simulation(delivery_job, now=start_time + timedelta(seconds=310))
        completed.refresh_from_db()
        sub_order.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(completed.status, DeliveryJob.Status.DELIVERED)
        self.assertEqual(sub_order.status, Order.Status.DELIVERED)
        self.assertEqual(order.status, Order.Status.DELIVERED)

    def test_restart_simulation_endpoint_resets_sandbox_delivery(self):
        _, sub_order = self._build_order(sub_order_status=Order.Status.READY)
        delivery_job = DeliveryJob.objects.create(
            sub_order=sub_order,
            provider=DeliveryJob.Provider.STUART,
            provider_reference="job_suborder:restart",
            package_reference="pkg_suborder:restart",
            client_reference=f"suborder:{sub_order.id}",
            status=DeliveryJob.Status.DELIVERING,
            tracking_url="https://tracking.stuart.test/restart",
            client_tracking_url="https://client.stuart.test/restart",
            pickup_address_snapshot={"full_address": "Unit 5 Farm Lane, Bristol, BS1 4DJ", "postcode": "BS1 4DJ"},
            dropoff_address_snapshot={"full_address": "45 Park Street, Bristol, BS1 5JG", "postcode": "BS1 5JG"},
            test_mode=True,
            simulation_started_at=timezone.now() - timedelta(minutes=1),
            simulation_duration_seconds=300,
        )
        old_started_at = delivery_job.simulation_started_at

        restart_res = self.producer_client.post(
            f"/api/delivery/producer/sub-orders/{sub_order.id}/delivery/restart-simulation/",
        )
        self.assertEqual(restart_res.status_code, status.HTTP_200_OK)
        delivery_job.refresh_from_db()
        self.assertNotEqual(delivery_job.simulation_started_at, old_started_at)
        self.assertEqual(delivery_job.status, DeliveryJob.Status.ASSIGNED)
        self.assertEqual(restart_res.data["delivery"]["status"], DeliveryJob.Status.ASSIGNED)

    def test_non_test_deliveries_do_not_auto_simulate(self):
        _, sub_order = self._build_order(sub_order_status=Order.Status.CONFIRMED)

        with patch(
            "apps.delivery.services._service_request",
            return_value={
                "job_id": f"job_suborder:{sub_order.id}",
                "package_id": f"pkg_suborder:{sub_order.id}",
                "client_reference": f"suborder:{sub_order.id}",
                "status": "created",
                "test_mode": False,
            },
        ):
            response = self.producer_client.patch(
                f"/api/orders/producer/sub-orders/{sub_order.id}/status/",
                {"status": Order.Status.READY},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        delivery_job = DeliveryJob.objects.get(sub_order=sub_order)
        self.assertIsNone(delivery_job.simulation_started_at)
        self.assertEqual(delivery_job.status, DeliveryJob.Status.CREATED)

    def test_webhook_marks_delivery_delivered_idempotently(self):
        order, sub_order = self._build_order(sub_order_status=Order.Status.READY)
        delivery_job = DeliveryJob.objects.create(
            sub_order=sub_order,
            provider=DeliveryJob.Provider.STUART,
            provider_reference="job_suborder:delivered",
            package_reference="pkg_suborder:delivered",
            client_reference=f"suborder:{sub_order.id}",
            status=DeliveryJob.Status.DELIVERING,
            tracking_url="https://tracking.stuart.test/live",
            client_tracking_url="https://client.stuart.test/live",
            pickup_address_snapshot={"full_address": "Unit 5 Farm Lane, Bristol, BS1 4DJ"},
            dropoff_address_snapshot={"full_address": "45 Park Street, Bristol, BS1 5JG"},
        )

        payload = {
            "id": "evt_delivery_1",
            "topic": "package_delivered",
            "details": {
                "package": {
                    "id": delivery_job.package_reference,
                    "reference": delivery_job.client_reference,
                    "tracking_url": delivery_job.tracking_url,
                }
            },
        }
        first = self.client.post(
            "/api/delivery/stuart/webhook/",
            payload,
            format="json",
            HTTP_X_STUART_WEBHOOK_SECRET="stuart-webhook-secret",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertFalse(first.data["duplicate"])

        delivery_job.refresh_from_db()
        sub_order.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(delivery_job.status, DeliveryJob.Status.DELIVERED)
        self.assertEqual(sub_order.status, Order.Status.DELIVERED)
        self.assertEqual(order.status, Order.Status.DELIVERED)
        self.assertEqual(DeliveryEvent.objects.count(), 1)

        second = self.client.post(
            "/api/delivery/stuart/webhook/",
            payload,
            format="json",
            HTTP_X_STUART_WEBHOOK_SECRET="stuart-webhook-secret",
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data["duplicate"])
        self.assertEqual(DeliveryEvent.objects.count(), 1)
        self.assertEqual(sync_delivery_job_simulation(delivery_job).status, DeliveryJob.Status.DELIVERED)

    def test_producer_and_customer_payloads_include_delivery_block(self):
        order, sub_order = self._build_order(sub_order_status=Order.Status.READY)
        DeliveryJob.objects.create(
            sub_order=sub_order,
            provider=DeliveryJob.Provider.STUART,
            provider_reference="job_suborder:payload",
            package_reference="pkg_suborder:payload",
            client_reference=f"suborder:{sub_order.id}",
            status=DeliveryJob.Status.ASSIGNED,
            tracking_url="https://tracking.stuart.test/payload",
            client_tracking_url="https://client.stuart.test/payload",
            pickup_address_snapshot={"full_address": "Unit 5 Farm Lane, Bristol, BS1 4DJ"},
            dropoff_address_snapshot={"full_address": "45 Park Street, Bristol, BS1 5JG"},
        )

        producer_list = self.producer_client.get("/api/orders/producer/sub-orders/")
        self.assertEqual(producer_list.status_code, status.HTTP_200_OK)
        self.assertEqual(producer_list.data[0]["delivery"]["provider_reference"], "job_suborder:payload")
        self.assertIn("simulation_started_at", producer_list.data[0]["delivery"])

        customer_detail = self.customer_client.get(f"/api/orders/history/{order.id}/")
        self.assertEqual(customer_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(customer_detail.data["sub_orders"][0]["delivery"]["status"], DeliveryJob.Status.ASSIGNED)
        self.assertEqual(
            customer_detail.data["sub_orders"][0]["delivery"]["client_tracking_url"],
            "https://client.stuart.test/payload",
        )

    def test_restart_delivery_job_simulation_helper_rejects_terminal_deliveries(self):
        _, sub_order = self._build_order(sub_order_status=Order.Status.READY)
        delivery_job = DeliveryJob.objects.create(
            sub_order=sub_order,
            provider=DeliveryJob.Provider.STUART,
            provider_reference="job_suborder:terminal",
            package_reference="pkg_suborder:terminal",
            client_reference=f"suborder:{sub_order.id}",
            status=DeliveryJob.Status.DELIVERED,
            test_mode=True,
            simulation_started_at=timezone.now(),
            simulation_duration_seconds=300,
        )

        with self.assertRaisesMessage(ValueError, "Simulation restart is not available for delivered or cancelled orders."):
            restart_delivery_job_simulation(delivery_job)

    def test_multi_producer_dispatch_creates_isolated_delivery_job_per_sub_order(self):
        _, sub_order_a, sub_order_b = self._build_multi_producer_order()

        ready_res = self.producer_client.patch(
            f"/api/orders/producer/sub-orders/{sub_order_a.id}/status/",
            {"status": Order.Status.READY},
            format="json",
        )

        self.assertEqual(ready_res.status_code, status.HTTP_200_OK)
        self.assertEqual(DeliveryJob.objects.filter(sub_order=sub_order_a).count(), 1)
        self.assertEqual(DeliveryJob.objects.filter(sub_order=sub_order_b).count(), 0)
        self.assertEqual(DeliveryJob.objects.get(sub_order=sub_order_a).client_reference, f"suborder:{sub_order_a.id}")
