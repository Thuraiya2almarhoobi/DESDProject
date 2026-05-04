"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin

from .models import ProductReview


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    """
    Documents the `ProductReviewAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the community domain: community feedback, review policy, and urls/views used by shared buyer-community workflows.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "product", "reviewer_name", "rating", "verified_purchase", "created_at")
    list_filter = ("rating", "verified_purchase", "created_at")
    search_fields = ("product__name", "reviewer_name", "comment")
