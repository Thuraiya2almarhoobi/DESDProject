"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin

from .models import SettlementOrderLine, WeeklySettlement


class SettlementOrderLineInline(admin.TabularInline):
    """
    Documents the `SettlementOrderLineInline` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    model = SettlementOrderLine
    extra = 0
    readonly_fields = (
        "order",
        "customer_name",
        "gross_amount",
        "commission_amount",
        "net_amount",
    )


@admin.register(WeeklySettlement)
class WeeklySettlementAdmin(admin.ModelAdmin):
    """
    Documents the `WeeklySettlementAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = (
        "id",
        "producer",
        "week_start",
        "week_end",
        "gross_amount",
        "commission_amount",
        "net_amount",
        "status",
        "transaction_reference",
    )
    list_filter = ("status", "week_start", "week_end")
    search_fields = ("transaction_reference", "producer__email")
    inlines = [SettlementOrderLineInline]
