"""
DESD Marketplace documentation.

File role:
    Defines persistent database models, relationships, and domain methods for this app.

Domain context:
    Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.db import models

from apps.orders.models import ProducerSubOrder


class DeliveryJob(models.Model):
    """
    Documents the `DeliveryJob` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the delivery domain: delivery jobs, tracking snapshots, stuart/simulation integration, and delivery api endpoints.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Provider(models.TextChoices):
        STUART = "stuart", "Stuart"

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        ASSIGNED = "assigned", "Assigned"
        WAITING_PICKUP = "waiting_pickup", "Waiting Pickup"
        PICKING_UP = "picking_up", "Picking Up"
        PICKED_UP = "picked_up", "Picked Up"
        DELIVERING = "delivering", "Delivering"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"
        FAILED = "failed", "Failed"
        UNKNOWN = "unknown", "Unknown"

    sub_order = models.ForeignKey(
        ProducerSubOrder,
        on_delete=models.CASCADE,
        related_name="delivery_jobs",
    )
    provider = models.CharField(max_length=40, choices=Provider.choices, default=Provider.STUART)
    provider_reference = models.CharField(max_length=120, blank=True, db_index=True)
    package_reference = models.CharField(max_length=120, blank=True, db_index=True)
    client_reference = models.CharField(max_length=120, blank=True, db_index=True)
    status = models.CharField(max_length=40, choices=Status.choices, default=Status.UNKNOWN)
    tracking_url = models.URLField(blank=True)
    client_tracking_url = models.URLField(blank=True)
    eta_to_dropoff = models.DateTimeField(null=True, blank=True)
    courier_name = models.CharField(max_length=255, blank=True)
    courier_phone = models.CharField(max_length=50, blank=True)
    courier_transport_type = models.CharField(max_length=100, blank=True)
    last_courier_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_courier_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    pickup_address_snapshot = models.JSONField(default=dict, blank=True)
    dropoff_address_snapshot = models.JSONField(default=dict, blank=True)
    quote_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    quote_currency = models.CharField(max_length=3, blank=True)
    last_error = models.CharField(max_length=255, blank=True)
    test_mode = models.BooleanField(default=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    simulation_started_at = models.DateTimeField(null=True, blank=True)
    simulation_duration_seconds = models.PositiveIntegerField(default=0)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        reference = self.package_reference or self.provider_reference or f"sub-order-{self.sub_order_id}"
        return f"{self.provider}:{reference}"


class DeliveryEvent(models.Model):
    """
    Documents the `DeliveryEvent` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the delivery domain: delivery jobs, tracking snapshots, stuart/simulation integration, and delivery api endpoints.
    can be changed without spreading the same responsibility across unrelated files.
    """
    delivery_job = models.ForeignKey(
        DeliveryJob,
        on_delete=models.CASCADE,
        related_name="events",
    )
    provider_event_id = models.CharField(max_length=120, blank=True, db_index=True)
    event_type = models.CharField(max_length=120, blank=True)
    normalized_status = models.CharField(max_length=40, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at", "-id"]

    def __str__(self) -> str:
        event_id = self.provider_event_id or f"event-{self.id}"
        return f"{self.delivery_job_id}:{event_id}"
