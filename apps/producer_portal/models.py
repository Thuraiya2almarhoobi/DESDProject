"""
DESD Marketplace documentation.

File role:
    Defines persistent database models, relationships, and domain methods for this app.

Domain context:
    Producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone

from bristol_marketplace.seasonality import (
    format_month_range,
    is_current_month_in_range,
    season_reminder,
)


class ProductAvailability(models.TextChoices):
    """
    Documents the `ProductAvailability` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    IN_SEASON = "in_season", "In Season"
    YEAR_ROUND = "year_round", "Year-round"
    UNAVAILABLE = "unavailable", "Unavailable"


class OrderStatus(models.TextChoices):
    """
    Documents the `OrderStatus` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    PREPARING = "preparing", "Preparing"
    READY = "ready", "Ready"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class ProducerProduct(models.Model):
    """
    Documents the `ProducerProduct` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
    season_start_month = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )
    season_end_month = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )
    stock_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(1), MaxValueValidator(9999)],
    )
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
        if self.availability == ProductAvailability.IN_SEASON:
            if not self.season_start_month or not self.season_end_month:
                raise ValidationError(
                    {
                        "season_start_month": "Season start month is required for seasonal products.",
                        "season_end_month": "Season end month is required for seasonal products.",
                    }
                )
        else:
            self.season_start_month = None
            self.season_end_month = None

    @property
    def is_visible_to_customers(self) -> bool:
        return self.stock_quantity > 0 and self.effective_availability != ProductAvailability.UNAVAILABLE

    @property
    def seasonal_window_label(self) -> str:
        return format_month_range(self.season_start_month, self.season_end_month)

    def is_currently_in_season(self, reference_date=None) -> bool:
        if self.availability == ProductAvailability.UNAVAILABLE:
            return False
        if self.availability == ProductAvailability.YEAR_ROUND:
            return True
        if self.season_start_month and self.season_end_month:
            return is_current_month_in_range(self.season_start_month, self.season_end_month, reference_date)
        return True

    @property
    def effective_availability(self) -> str:
        if self.stock_quantity <= 0:
            return ProductAvailability.UNAVAILABLE
        if self.availability == ProductAvailability.UNAVAILABLE:
            return ProductAvailability.UNAVAILABLE
        if self.availability == ProductAvailability.YEAR_ROUND:
            return ProductAvailability.YEAR_ROUND
        return (
            ProductAvailability.IN_SEASON
            if self.is_currently_in_season()
            else ProductAvailability.UNAVAILABLE
        )

    @property
    def season_status_message(self) -> str:
        if self.availability == ProductAvailability.YEAR_ROUND:
            return "Available year-round."
        if self.availability == ProductAvailability.UNAVAILABLE:
            return "Hidden from customers until you mark it available."
        window = self.seasonal_window_label or "seasonal window"
        if self.is_currently_in_season():
            return f"In season now. Customers can order during {window}."
        return f"Out of season right now. Customers will see it again during {window}."

    @property
    def season_reminder_message(self) -> str:
        if self.availability != ProductAvailability.IN_SEASON:
            return ""
        reminder = season_reminder(self.season_start_month, self.season_end_month)
        if not reminder.starts_within_days or reminder.days_until_start in {None, 0}:
            return ""
        if reminder.days_until_start == 1:
            return f"{self.name} becomes available tomorrow."
        return f"{self.name} becomes available in {reminder.days_until_start} days."

    def __str__(self) -> str:
        return f"{self.name} ({self.producer_id})"


class ProducerOrder(models.Model):
    """
    Documents the `ProducerOrder` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
    """
    Documents the `ProducerOrderItem` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the producer portal domain: producer inventory, dashboard summaries, order management, and producer-facing apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
