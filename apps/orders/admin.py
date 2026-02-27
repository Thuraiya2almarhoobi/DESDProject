from django.contrib import admin

from .models import (
    Cart,
    CartItem,
    CustomerProfile,
    Order,
    OrderItem,
    PaymentTransaction,
    Producer,
    ProducerNotification,
    ProducerSubOrder,
    Product,
)


@admin.register(Producer)
class ProducerAdmin(admin.ModelAdmin):
    list_display = ("business_name", "postcode", "lead_time_hours", "is_active")
    search_fields = ("business_name", "postcode")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "producer", "price", "stock_quantity", "is_available", "in_season")
    list_filter = ("producer", "is_available", "in_season")
    search_fields = ("name", "category", "producer__business_name")


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "postcode", "updated_at")
    search_fields = ("user__email", "postcode")


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("customer", "updated_at")
    inlines = [CartItemInline]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_name", "producer_name", "quantity", "unit_price", "line_total")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "customer", "status", "payment_status", "total_amount", "created_at")
    list_filter = ("status", "payment_status", "created_at")
    search_fields = ("order_number", "customer__email")
    inlines = [OrderItemInline]


@admin.register(ProducerSubOrder)
class ProducerSubOrderAdmin(admin.ModelAdmin):
    list_display = ("order", "producer", "status", "delivery_date", "payout_amount")
    list_filter = ("status", "delivery_date")


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("order", "provider", "provider_reference", "amount", "status", "test_mode")
    list_filter = ("provider", "status", "test_mode")


@admin.register(ProducerNotification)
class ProducerNotificationAdmin(admin.ModelAdmin):
    list_display = ("producer", "sub_order", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
