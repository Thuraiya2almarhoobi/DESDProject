from django.contrib import admin

from .models import SettlementOrderLine, WeeklySettlement


class SettlementOrderLineInline(admin.TabularInline):
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
