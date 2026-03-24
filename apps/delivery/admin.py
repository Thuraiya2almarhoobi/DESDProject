from django.contrib import admin

from .models import DeliveryEvent, DeliveryJob


@admin.register(DeliveryJob)
class DeliveryJobAdmin(admin.ModelAdmin):
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
    list_display = ("delivery_job", "provider_event_id", "event_type", "normalized_status", "received_at")
    list_filter = ("event_type", "normalized_status")
    search_fields = ("provider_event_id", "delivery_job__provider_reference", "delivery_job__package_reference")

