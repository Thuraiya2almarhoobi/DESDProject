from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, PaymentTransaction
from apps.producer_portal.models import OrderStatus, ProducerOrder

from .models import SettlementOrderLine, SettlementStatus, WeeklySettlement

COMMISSION_RATE = Decimal("0.05")
STRIPE_SUCCESS_EVENT_TYPES = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
}
STRIPE_FAILURE_EVENT_TYPES = {
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
}


@dataclass(frozen=True)
class SettlementWeekRange:
    start: date
    end: date


@dataclass(frozen=True)
class StripeCheckoutSessionResult:
    session_id: str
    checkout_url: str
    publishable_key: str
    test_mode: bool


def get_previous_week_range(reference_date: date | None = None) -> SettlementWeekRange:
    reference_date = reference_date or timezone.localdate()
    current_week_monday = reference_date - timedelta(days=reference_date.weekday())
    previous_week_start = current_week_monday - timedelta(days=7)
    previous_week_end = current_week_monday - timedelta(days=1)
    return SettlementWeekRange(start=previous_week_start, end=previous_week_end)


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _money_to_minor_units(value: Decimal) -> int:
    return int((_money(value) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _stripe_value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _validated_stripe_keys() -> tuple[str, str]:
    secret_key = (getattr(settings, "STRIPE_SECRET_KEY", "") or "").strip()
    publishable_key = (getattr(settings, "STRIPE_PUBLISHABLE_KEY", "") or "").strip()

    if not secret_key or not publishable_key:
        raise ValueError("Stripe test keys are not configured.")
    if secret_key.startswith("sk_live_") or publishable_key.startswith("pk_live_"):
        raise ValueError("Live Stripe keys are not allowed. Use Stripe test keys only.")
    if not secret_key.startswith("sk_test_") or not publishable_key.startswith("pk_test_"):
        raise ValueError("Stripe keys must be test mode keys.")

    return secret_key, publishable_key


def _validated_webhook_secret() -> str:
    webhook_secret = (getattr(settings, "STRIPE_WEBHOOK_SECRET", "") or "").strip()
    if not webhook_secret:
        raise ValueError("Stripe webhook secret is not configured.")
    return webhook_secret


def _configure_stripe() -> tuple[str, str]:
    secret_key, publishable_key = _validated_stripe_keys()
    stripe.api_key = secret_key
    return secret_key, publishable_key


def _build_stripe_line_items(order: Order) -> list[dict[str, Any]]:
    line_items: list[dict[str, Any]] = []
    for item in order.items.all():
        description = f"{item.quantity} {item.unit}"
        if item.producer_name:
            description = f"{description} from {item.producer_name}"
        line_items.append(
            {
                "price_data": {
                    "currency": "gbp",
                    "product_data": {
                        "name": item.product_name,
                        "description": description,
                    },
                    "unit_amount": _money_to_minor_units(item.line_total),
                },
                "quantity": 1,
            }
        )

    if not line_items:
        raise ValueError("Order has no items to pay for.")

    return line_items


@transaction.atomic
def create_stripe_checkout_session_for_order(order: Order) -> StripeCheckoutSessionResult:
    _, publishable_key = _configure_stripe()

    if order.payment_status == Order.PaymentStatus.PAID:
        raise ValueError("Order is already paid.")

    session = stripe.checkout.Session.create(
        mode="payment",
        client_reference_id=str(order.id),
        customer_email=order.customer.email or None,
        payment_method_types=["card"],
        line_items=_build_stripe_line_items(order),
        metadata={
            "order_id": str(order.id),
            "order_number": order.order_number,
        },
        payment_intent_data={
            "metadata": {
                "order_id": str(order.id),
                "order_number": order.order_number,
            }
        },
        success_url=settings.STRIPE_SUCCESS_URL,
        cancel_url=settings.STRIPE_CANCEL_URL,
    )

    session_id = _stripe_value(session, "id", "")
    checkout_url = _stripe_value(session, "url", "")
    livemode = bool(_stripe_value(session, "livemode", False))

    if not session_id or not checkout_url:
        raise ValueError("Stripe did not return a valid Checkout Session.")
    if livemode:
        raise ValueError("Stripe Checkout must run in test mode only.")

    transaction_record, _ = PaymentTransaction.objects.get_or_create(
        order=order,
        defaults={
            "provider": "stripe",
            "provider_reference": session_id,
            "amount": order.total_amount,
            "status": "pending",
            "test_mode": True,
            "raw_payload": {},
        },
    )

    raw_payload = dict(transaction_record.raw_payload or {})
    raw_payload.update(
        {
            "checkout_session_id": session_id,
            "checkout_url": checkout_url,
            "payment_status": "pending",
            "livemode": False,
            "processed_event_ids": raw_payload.get("processed_event_ids", []),
        }
    )

    transaction_record.provider = "stripe"
    transaction_record.provider_reference = session_id
    transaction_record.amount = order.total_amount
    transaction_record.status = "pending"
    transaction_record.test_mode = True
    transaction_record.raw_payload = raw_payload
    transaction_record.save(
        update_fields=[
            "provider",
            "provider_reference",
            "amount",
            "status",
            "test_mode",
            "raw_payload",
        ]
    )

    order.payment_status = Order.PaymentStatus.PENDING
    order.payment_method = "stripe_checkout"
    order.payment_reference = session_id
    order.save(update_fields=["payment_status", "payment_method", "payment_reference", "updated_at"])

    return StripeCheckoutSessionResult(
        session_id=session_id,
        checkout_url=checkout_url,
        publishable_key=publishable_key,
        test_mode=True,
    )


def verify_and_construct_stripe_event(payload: bytes, signature: str) -> dict[str, Any]:
    _configure_stripe()
    webhook_secret = _validated_webhook_secret()

    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=signature, secret=webhook_secret)
    except Exception as exc:
        raise ValueError("Invalid Stripe webhook signature.") from exc

    if hasattr(event, "to_dict_recursive"):
        return event.to_dict_recursive()
    return event


@transaction.atomic
def handle_stripe_webhook_event(event: dict[str, Any]) -> dict[str, Any]:
    if bool(event.get("livemode", False)):
        raise ValueError("Live mode Stripe events are not allowed.")

    event_type = str(event.get("type", ""))
    handled_event_types = STRIPE_SUCCESS_EVENT_TYPES | STRIPE_FAILURE_EVENT_TYPES
    if event_type not in handled_event_types:
        return {"handled": False, "duplicate": False, "event_type": event_type}

    session = (event.get("data") or {}).get("object") or {}
    metadata = session.get("metadata") or {}
    order_id = metadata.get("order_id") or session.get("client_reference_id")
    session_id = session.get("id") or ""
    payment_intent = session.get("payment_intent") or ""
    event_id = str(event.get("id", ""))

    transaction_record = None
    order = None

    if order_id:
        order = Order.objects.select_for_update().filter(pk=order_id).first()
    if order is None and session_id:
        transaction_record = (
            PaymentTransaction.objects.select_for_update()
            .select_related("order")
            .filter(provider="stripe", provider_reference=session_id)
            .first()
        )
        if transaction_record is not None:
            order = transaction_record.order

    if order is None:
        raise ValueError("Unable to match Stripe event to an order.")

    if transaction_record is None:
        transaction_record = PaymentTransaction.objects.select_for_update().filter(order=order).first()

    if transaction_record is None:
        transaction_record = PaymentTransaction.objects.create(
            order=order,
            provider="stripe",
            provider_reference=session_id or payment_intent or f"evt-{event_id or order.id}",
            amount=order.total_amount,
            status="pending",
            test_mode=True,
            raw_payload={},
        )

    raw_payload = dict(transaction_record.raw_payload or {})
    processed_event_ids = [str(value) for value in raw_payload.get("processed_event_ids", []) if value]
    if event_id and event_id in processed_event_ids:
        return {
            "handled": True,
            "duplicate": True,
            "event_type": event_type,
            "order_id": order.id,
            "payment_status": order.payment_status,
        }

    next_payment_status = (
        Order.PaymentStatus.PAID if event_type in STRIPE_SUCCESS_EVENT_TYPES else Order.PaymentStatus.FAILED
    )
    next_transaction_status = "succeeded" if next_payment_status == Order.PaymentStatus.PAID else "failed"

    order.payment_status = next_payment_status
    order.payment_method = "stripe_checkout"
    if payment_intent:
        order.payment_reference = payment_intent
    elif session_id and not order.payment_reference:
        order.payment_reference = session_id
    order.save(update_fields=["payment_status", "payment_method", "payment_reference", "updated_at"])

    if event_id:
        processed_event_ids.append(event_id)
    raw_payload.update(
        {
            "checkout_session_id": session_id,
            "payment_intent": payment_intent,
            "last_event_id": event_id,
            "last_event_type": event_type,
            "livemode": False,
            "processed_event_ids": processed_event_ids,
        }
    )

    transaction_record.provider = "stripe"
    if session_id:
        transaction_record.provider_reference = session_id
    transaction_record.amount = order.total_amount
    transaction_record.status = next_transaction_status
    transaction_record.test_mode = True
    transaction_record.raw_payload = raw_payload
    transaction_record.save(
        update_fields=[
            "provider",
            "provider_reference",
            "amount",
            "status",
            "test_mode",
            "raw_payload",
        ]
    )

    return {
        "handled": True,
        "duplicate": False,
        "event_type": event_type,
        "order_id": order.id,
        "payment_status": order.payment_status,
    }


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
