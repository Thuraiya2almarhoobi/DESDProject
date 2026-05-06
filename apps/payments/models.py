"""
DESD Marketplace documentation.

File role:
    Defines persistent database models, relationships, and domain methods for this app.

Domain context:
    Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.

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
from django.core.validators import MinValueValidator
from django.db import models


class SettlementStatus(models.TextChoices):
    """
    Documents the `SettlementStatus` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    PROCESSED = "processed", "Processed"
    PENDING_BANK_TRANSFER = "pending_bank_transfer", "Pending Bank Transfer"


class WeeklySettlement(models.Model):
    """
    Documents the `WeeklySettlement` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="weekly_settlements",
    )
    week_start = models.DateField()
    week_end = models.DateField()
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(
        max_length=24,
        choices=SettlementStatus.choices,
        default=SettlementStatus.PENDING_BANK_TRANSFER,
    )
    transaction_reference = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-week_start", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["producer", "week_start", "week_end"],
                name="unique_weekly_settlement_per_producer",
            )
        ]

    def __str__(self) -> str:
        return f"{self.producer_id}:{self.week_start}→{self.week_end}"


class SettlementOrderLine(models.Model):
    """
    Documents the `SettlementOrderLine` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    settlement = models.ForeignKey(WeeklySettlement, on_delete=models.CASCADE, related_name="lines")
    order = models.ForeignKey(
        "producer_portal.ProducerOrder",
        on_delete=models.PROTECT,
        related_name="settlement_lines",
        null=True,
        blank=True,
    )
    sub_order = models.ForeignKey(
        "orders.ProducerSubOrder",
        on_delete=models.PROTECT,
        related_name="settlement_lines",
        null=True,
        blank=True,
    )
    customer_name = models.CharField(max_length=120)
    gross_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    commission_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    net_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["settlement", "order"], name="unique_order_per_settlement"),
            models.UniqueConstraint(fields=["settlement", "sub_order"], name="unique_sub_order_per_settlement"),
        ]

    def __str__(self) -> str:
        return f"{self.settlement_id}:{self.order_id or self.sub_order_id}"
