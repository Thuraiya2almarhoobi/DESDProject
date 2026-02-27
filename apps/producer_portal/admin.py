from django.contrib import admin

from .models import ProducerOrder, ProducerOrderItem, ProducerProduct


@admin.register(ProducerProduct)
class ProducerProductAdmin(admin.ModelAdmin):
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
    model = ProducerOrderItem
    extra = 0
    readonly_fields = ("product_name", "quantity", "unit_price", "line_total")


@admin.register(ProducerOrder)
class ProducerOrderAdmin(admin.ModelAdmin):
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
