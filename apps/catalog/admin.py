"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin

from .models import Category, Producer, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """
    Documents the `CategoryAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "name", "slug")
    search_fields = ("name", "slug")


@admin.register(Producer)
class ProducerAdmin(admin.ModelAdmin):
    """
    Documents the `ProducerAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "name", "location", "delivery_lead_time")
    search_fields = ("name", "location")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    """
    Documents the `ProductAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
