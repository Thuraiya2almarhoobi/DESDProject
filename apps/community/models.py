from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.catalog.models import Product


class ProductReview(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="product_reviews",
    )
    reviewer_name = models.CharField(max_length=120)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    verified_purchase = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["product", "created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                condition=Q(user__isnull=False),
                name="community_unique_review_per_user_product",
            )
        ]

    def __str__(self) -> str:
        return f"{self.product.name} ({self.rating}/5)"
