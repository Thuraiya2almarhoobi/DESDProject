from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from apps.producer_portal.models import OrderStatus, ProducerOrder

from .models import SettlementOrderLine, SettlementStatus, WeeklySettlement

COMMISSION_RATE = Decimal("0.05")


@dataclass(frozen=True)
class SettlementWeekRange:
    start: date
    end: date


def get_previous_week_range(reference_date: date | None = None) -> SettlementWeekRange:
    reference_date = reference_date or timezone.localdate()
    # Monday is 0; previous week ends on Sunday.
    current_week_monday = reference_date - timedelta(days=reference_date.weekday())
    previous_week_start = current_week_monday - timedelta(days=7)
    previous_week_end = current_week_monday - timedelta(days=1)
    return SettlementWeekRange(start=previous_week_start, end=previous_week_end)


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@transaction.atomic
def process_weekly_settlements(reference_date: date | None = None) -> list[WeeklySettlement]:
    week_range = get_previous_week_range(reference_date)
    candidate_orders = (
        ProducerOrder.objects.select_related("producer")
        .filter(
            status=OrderStatus.DELIVERED,
            settlement_processed=False,
            delivery_date__date__gte=week_range.start,
            delivery_date__date__lte=week_range.end,
        )
        .order_by("producer_id", "delivery_date", "id")
    )

    by_producer: dict[int, list[ProducerOrder]] = {}
    for order in candidate_orders:
        by_producer.setdefault(order.producer_id, []).append(order)

    settlements: list[WeeklySettlement] = []

    for producer_id, orders in by_producer.items():
        gross_total = _money(sum((order.total_value for order in orders), Decimal("0.00")))
        commission_total = _money(gross_total * COMMISSION_RATE)
        net_total = _money(gross_total - commission_total)

        settlement, created = WeeklySettlement.objects.get_or_create(
            producer_id=producer_id,
            week_start=week_range.start,
            week_end=week_range.end,
            defaults={
                "gross_amount": gross_total,
                "commission_amount": commission_total,
                "net_amount": net_total,
                "status": SettlementStatus.PENDING_BANK_TRANSFER,
                "transaction_reference": (
                    f"SET-{week_range.start.strftime('%Y%m%d')}-{producer_id}-{timezone.now().strftime('%H%M%S%f')}"
                ),
            },
        )
        if not created:
            continue

        for order in orders:
            order_commission = _money(order.total_value * COMMISSION_RATE)
            order_net = _money(order.total_value - order_commission)
            SettlementOrderLine.objects.create(
                settlement=settlement,
                order=order,
                customer_name=order.customer_name,
                gross_amount=order.total_value,
                commission_amount=order_commission,
                net_amount=order_net,
            )
            order.settlement_processed = True
            order.save(update_fields=["settlement_processed", "updated_at"])

        settlements.append(settlement)

    return settlements
