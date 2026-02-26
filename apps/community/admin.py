from django.contrib import admin

from .models import ProductReview


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "reviewer_name", "rating", "verified_purchase", "created_at")
    list_filter = ("rating", "verified_purchase", "created_at")
    search_fields = ("product__name", "reviewer_name", "comment")
