"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin

from .models import DeliveryEvent, DeliveryJob


@admin.register(DeliveryJob)
class DeliveryJobAdmin(admin.ModelAdmin):
    """
    Documents the `DeliveryJobAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the delivery domain: delivery jobs, tracking snapshots, stuart/simulation integration, and delivery api endpoints.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = (
        "sub_order",
        "provider",
        "provider_reference",
        "package_reference",
        "status",
        "test_mode",
        "created_at",
    )
    list_filter = ("provider", "status", "test_mode")
    search_fields = ("provider_reference", "package_reference", "client_reference", "sub_order__order__order_number")


@admin.register(DeliveryEvent)
class DeliveryEventAdmin(admin.ModelAdmin):
    """
    Documents the `DeliveryEventAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the delivery domain: delivery jobs, tracking snapshots, stuart/simulation integration, and delivery api endpoints.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("delivery_job", "provider_event_id", "event_type", "normalized_status", "received_at")
    list_filter = ("event_type", "normalized_status")
    search_fields = ("provider_event_id", "delivery_job__provider_reference", "delivery_job__package_reference")
