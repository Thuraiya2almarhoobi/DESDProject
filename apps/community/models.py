"""
DESD Marketplace documentation.

File role:
    Defines persistent database models, relationships, and domain methods for this app.

Domain context:
    Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.catalog.models import Product


class ProductReview(models.Model):
    """
    Documents the `ProductReview` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the community domain: community feedback, review policy, and urls/views used by shared buyer-community workflows.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class ModerationStatus(models.TextChoices):
        PUBLISHED = "published", "Published"
        PENDING = "pending", "Pending moderation"
        REJECTED = "rejected", "Rejected"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="product_reviews",
    )
    title = models.CharField(max_length=120, blank=True)
    reviewer_name = models.CharField(max_length=120)
    is_anonymous = models.BooleanField(default=False)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    verified_purchase = models.BooleanField(default=False)
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PUBLISHED,
    )
    moderation_reason = models.CharField(max_length=255, blank=True)
    producer_response = models.TextField(blank=True)
    producer_response_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "created_at"]),
            models.Index(
                fields=["product", "moderation_status"],
                name="community_p_product_f888b3_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                condition=Q(user__isnull=False, moderation_status__in=["published", "pending"]),
                name="community_unique_review_per_user_product",
            )
        ]

    def __str__(self) -> str:
        return f"{self.product.name} ({self.rating}/5)"
