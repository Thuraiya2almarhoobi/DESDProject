"""
DESD Marketplace documentation.

File role:
    Defines persistent database models, relationships, and domain methods for this app.

Domain context:
    Geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.db import models


class PostcodeLocation(models.Model):
    """
    Documents the `PostcodeLocation` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.
    can be changed without spreading the same responsibility across unrelated files.
    """
    postcode = models.CharField(max_length=12, unique=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["postcode"]

    def __str__(self) -> str:
        return self.postcode
