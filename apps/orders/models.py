"""
DESD Marketplace documentation.

File role:
    Defines persistent database models, relationships, and domain methods for this app.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from decimal import Decimal
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from bristol_marketplace.seasonality import format_month_range, is_current_month_in_range


def _generate_order_number() -> str:
    """
    Helper for the file role: Defines persistent database models, relationships, and domain methods for this app.

    `_generate_order_number` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    return f"ORD-{uuid4().hex[:10].upper()}"


class Producer(models.Model):
    """
    Documents the `Producer` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders_producer_profile",
    )
    business_name = models.CharField(max_length=255, unique=True)
    contact_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    postcode = models.CharField(max_length=12)
    lead_time_hours = models.PositiveIntegerField(default=48)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["business_name"]

    def __str__(self) -> str:
        return self.business_name


class CustomerProfile(models.Model):
    """
    Documents the `CustomerProfile` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders_customer_profile"
    )
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    delivery_address = models.TextField(blank=True)
    postcode = models.CharField(max_length=12, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"CustomerProfile({self.user_id})"


class Product(models.Model):
    """
    Documents the `Product` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer = models.ForeignKey(Producer, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=30, default="unit")
    price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    stock_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))], default=0
    )
    is_available = models.BooleanField(default=True)
    in_season = models.BooleanField(default=True)
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
    harvest_date = models.DateField(null=True, blank=True)
    allergen_info = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    @property
    def seasonal_window_label(self) -> str:
        return format_month_range(self.season_start_month, self.season_end_month)

    def is_currently_in_season(self, reference_date=None) -> bool:
        if self.season_start_month and self.season_end_month:
            return is_current_month_in_range(self.season_start_month, self.season_end_month, reference_date)
        return bool(self.in_season)

    def effective_availability(self, reference_date=None) -> str:
        if not self.is_available or self.stock_quantity <= Decimal("0.00"):
            return "unavailable"
        if self.season_start_month and self.season_end_month:
            return "in-season" if self.is_currently_in_season(reference_date) else "unavailable"
        if self.in_season:
            return "in-season"
        return "year-round"

    def is_orderable(self, reference_date=None) -> bool:
        return self.effective_availability(reference_date) != "unavailable"

    def __str__(self) -> str:
        return f"{self.name} ({self.producer.business_name})"


class Cart(models.Model):
    """
    Documents the `Cart` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Cart({self.customer_id})"


class CartItem(models.Model):
    """
    Documents the `CartItem` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="cart_items")
    quantity = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["cart", "product"], name="orders_unique_cart_product")
        ]
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.product.name} x {self.quantity}"

    @property
    def unit_price(self) -> Decimal:
        return self.product.price

    @property
    def line_total(self) -> Decimal:
        return (self.unit_price * self.quantity).quantize(Decimal("0.01"))


class Order(models.Model):
    """
    Documents the `Order` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        READY = "ready", "Ready"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders"
    )
    recurring_template = models.ForeignKey(
        "RecurringOrderTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_orders",
    )
    recurring_scheduled_for = models.DateField(null=True, blank=True)
    is_recurring_instance = models.BooleanField(default=False)
    order_number = models.CharField(max_length=20, unique=True, default=_generate_order_number)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PAID
    )
    delivery_address = models.TextField()
    customer_postcode = models.CharField(max_length=12)
    special_instructions = models.TextField(blank=True)
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.05"))
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    producer_payout_total = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=50, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.order_number


class ProducerSubOrder(models.Model):
    """
    Documents the `ProducerSubOrder` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="sub_orders")
    producer = models.ForeignKey(Producer, on_delete=models.CASCADE, related_name="sub_orders")
    status = models.CharField(
        max_length=20, choices=Order.Status.choices, default=Order.Status.PENDING
    )
    delivery_date = models.DateField()
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payout_amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["order", "producer"], name="orders_unique_suborder_per_producer"
            )
        ]

    def __str__(self) -> str:
        return f"{self.order.order_number} -> {self.producer.business_name}"


class OrderItem(models.Model):
    """
    Documents the `OrderItem` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    sub_order = models.ForeignKey(ProducerSubOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items"
    )
    product_name = models.CharField(max_length=255)
    producer_name = models.CharField(max_length=255)
    unit = models.CharField(max_length=30, default="unit")
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.product_name} ({self.order.order_number})"


class RecurringOrderTemplate(models.Model):
    """
    Documents the `RecurringOrderTemplate` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        FORTNIGHTLY = "fortnightly", "Fortnightly"

    restaurant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recurring_order_templates",
    )
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.WEEKLY)
    order_day = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(6)]
    )
    delivery_day = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(6)]
    )
    next_order_date = models.DateField()
    delivery_address = models.TextField()
    customer_postcode = models.CharField(max_length=12)
    payment_method = models.CharField(max_length=50, default="test_card", blank=True)
    is_paused = models.BooleanField(default=False)
    is_cancelled = models.BooleanField(default=False)
    last_generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        if getattr(self.restaurant, "role", None) != "RESTAURANT":
            raise ValidationError("Recurring templates can only be created for RESTAURANT users.")

    def __str__(self) -> str:
        return f"RecurringTemplate({self.restaurant_id}, {self.frequency})"


class RecurringOrderTemplateItem(models.Model):
    """
    Documents the `RecurringOrderTemplateItem` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    template = models.ForeignKey(
        RecurringOrderTemplate,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="recurring_template_items")
    default_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["template", "product"], name="orders_unique_template_product"
            )
        ]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.product_id} ({self.default_quantity})"


class RecurringOrderInstanceOverride(models.Model):
    """
    Documents the `RecurringOrderInstanceOverride` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    template = models.ForeignKey(
        RecurringOrderTemplate,
        on_delete=models.CASCADE,
        related_name="instance_overrides",
    )
    scheduled_order_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_recurring_overrides",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_order_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["template", "scheduled_order_date"],
                name="orders_unique_template_override_per_date",
            )
        ]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.scheduled_order_date}"


class RecurringOrderInstanceOverrideItem(models.Model):
    """
    Documents the `RecurringOrderInstanceOverrideItem` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    override = models.ForeignKey(
        RecurringOrderInstanceOverride,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="recurring_override_items")
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["override", "product"], name="orders_unique_override_product"
            )
        ]

    def __str__(self) -> str:
        return f"{self.override_id}:{self.product_id} ({self.quantity})"


class PaymentTransaction(models.Model):
    """
    Documents the `PaymentTransaction` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="payment")
    provider = models.CharField(max_length=50, default="mock")
    provider_reference = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="GBP")
    status = models.CharField(max_length=20, default="succeeded")
    test_mode = models.BooleanField(default=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.provider}:{self.provider_reference}"


class ProducerNotification(models.Model):
    """
    Documents the `ProducerNotification` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer = models.ForeignKey(Producer, on_delete=models.CASCADE, related_name="notifications")
    sub_order = models.ForeignKey(
        ProducerSubOrder, on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.message


class UserNotification(models.Model):
    """
    Documents the `UserNotification` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_notifications"
    )
    category = models.CharField(max_length=50, default="general")
    message = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.category}:{self.message[:40]}"
