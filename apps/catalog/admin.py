from django.contrib import admin

from .models import Category, Producer, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug")
    search_fields = ("name", "slug")


@admin.register(Producer)
class ProducerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "location", "delivery_lead_time")
    search_fields = ("name", "location")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "category",
        "producer",
        "price",
        "unit",
        "availability",
        "is_organic",
        "stock",
    )
    list_filter = ("category", "availability", "is_organic")
    search_fields = ("name", "description", "producer__name")
