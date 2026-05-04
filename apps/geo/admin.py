"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin

from .models import PostcodeLocation


@admin.register(PostcodeLocation)
class PostcodeLocationAdmin(admin.ModelAdmin):
    """
    Documents the `PostcodeLocationAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("postcode", "latitude", "longitude", "updated_at")
    search_fields = ("postcode",)
