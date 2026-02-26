from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


class ProductAvailability(models.TextChoices):
    IN_SEASON = "in_season", "In Season"
    YEAR_ROUND = "year_round", "Year-round"
    UNAVAILABLE = "unavailable", "Unavailable"


class OrderStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    PREPARING = "preparing", "Preparing"
    READY = "ready", "Ready"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class ProducerProduct(models.Model):
    producer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="producer_products",
    )
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=80)
    description = models.TextField()
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    unit = models.CharField(max_length=32)
    availability = models.CharField(
        max_length=20,
        choices=ProductAvailability.choices,
        default=ProductAvailability.IN_SEASON,
    )
    stock_quantity = models.PositiveIntegerField(default=0)
    allergen_information = models.CharField(max_length=255, blank=True)
    harvest_date = models.DateField()
    image_url = models.URLField(blank=True)
    is_surplus = models.BooleanField(default=False)
    surplus_discount_percent = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(10), MaxValueValidator(50)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self) -> None:
        if self.is_surplus and self.surplus_discount_percent is None:
            raise ValidationError(
                {"surplus_discount_percent": "Surplus discount is required when item is marked surplus."}
            )
        if not self.is_surplus:
            self.surplus_discount_percent = None

    @property
    def is_visible_to_customers(self) -> bool:
        return (
            self.stock_quantity > 0
            and self.availability in {ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND}
        )

    def __str__(self) -> str:
        return f"{self.name} ({self.producer_id})"


class ProducerOrder(models.Model):
    order_number = models.CharField(max_length=32, unique=True)
    producer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="producer_orders",
    )
    customer_name = models.CharField(max_length=120)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=30, blank=True)
    delivery_address = models.TextField()
    order_date = models.DateTimeField(default=timezone.now)
    delivery_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    total_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    special_instructions = models.TextField(blank=True)
    settlement_processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["delivery_date", "id"]

    def clean(self) -> None:
        min_delivery_date = self.order_date + timezone.timedelta(hours=48)
        if self.delivery_date < min_delivery_date:
            raise ValidationError({"delivery_date": "Delivery date must be at least 48 hours after order date."})

    @property
    def lead_time_hours(self) -> int:
        delta = self.delivery_date - self.order_date
        return int(delta.total_seconds() // 3600)

    def __str__(self) -> str:
        return self.order_number


class ProducerOrderItem(models.Model):
    order = models.ForeignKey(ProducerOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        ProducerProduct,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )
    product_name = models.CharField(max_length=160)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])

    class Meta:
        ordering = ["id"]

    @property
    def line_total(self) -> Decimal:
        return self.quantity * self.unit_price

    def save(self, *args, **kwargs):
        if not self.product_name and self.product:
            self.product_name = self.product.name
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.product_name} x {self.quantity}"
