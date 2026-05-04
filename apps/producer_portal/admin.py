"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin

from .models import ProducerOrder, ProducerOrderItem, ProducerProduct


@admin.register(ProducerProduct)
class ProducerProductAdmin(admin.ModelAdmin):
    """
    Documents the `ProducerProductAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = (
        "id",
        "name",
        "producer",
        "category",
        "price",
        "unit",
        "availability",
        "stock_quantity",
        "is_surplus",
    )
    list_filter = ("availability", "is_surplus", "category", "producer")
    search_fields = ("name", "category", "producer__email")


class ProducerOrderItemInline(admin.TabularInline):
    """
    Documents the `ProducerOrderItemInline` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    model = ProducerOrderItem
    extra = 0
    readonly_fields = ("product_name", "quantity", "unit_price", "line_total")


@admin.register(ProducerOrder)
class ProducerOrderAdmin(admin.ModelAdmin):
    """
    Documents the `ProducerOrderAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = (
        "order_number",
        "producer",
        "customer_name",
        "status",
        "delivery_date",
        "total_value",
        "settlement_processed",
    )
    list_filter = ("status", "settlement_processed", "delivery_date")
    search_fields = ("order_number", "customer_name", "customer_email", "producer__email")
    inlines = [ProducerOrderItemInline]
