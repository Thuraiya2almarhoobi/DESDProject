from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, PaymentTransaction
from apps.orders.services import (
    clear_checked_out_cart_items,
    create_order_notifications,
    release_stock_reservation_for_order,
)
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


@dataclass(frozen=True)
class StripeCheckoutSessionStatus:
    session_id: str
    payment_status: str
    checkout_status: str
    payment_intent: str
    livemode: bool


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


def _payment_value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _payment_service_base_url() -> str:
    base_url = (getattr(settings, "PAYMENT_SERVICE_BASE_URL", "") or "").strip().rstrip("/")
    if not base_url:
        raise ValueError("Stripe payment service is not configured.")
    return base_url


def _payment_service_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    shared_secret = (getattr(settings, "PAYMENT_SERVICE_SHARED_SECRET", "") or "").strip()
    if shared_secret:
        headers["X-Payment-Service-Token"] = shared_secret
    return headers


def _payment_service_timeout() -> int:
    return int(getattr(settings, "PAYMENT_SERVICE_TIMEOUT_SECONDS", 15))


def _payment_service_request(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_payment_service_base_url()}{path}"
    try:
        response = requests.post(
            url,
            json=payload,
            headers=_payment_service_headers(),
            timeout=_payment_service_timeout(),
        )
    except requests.RequestException as exc:
        raise ValueError("Stripe payment service is unavailable.") from exc

    try:
        response_payload = response.json()
    except ValueError:
        response_payload = {}

    if not response.ok:
        detail = response_payload.get("detail") if isinstance(response_payload, dict) else None
        if isinstance(detail, str) and detail.strip():
            raise ValueError(detail)
        raise ValueError("Stripe payment service request failed.")

    if not isinstance(response_payload, dict):
        raise ValueError("Stripe payment service returned an invalid response.")
    return response_payload


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
    if order.payment_status == Order.PaymentStatus.PAID:
        raise ValueError("Order is already paid.")

    session = _payment_service_request(
        "/stripe/checkout-sessions",
        {
            "client_reference_id": str(order.id),
            "customer_email": order.customer.email or "",
            "line_items": _build_stripe_line_items(order),
            "metadata": {
                "order_id": str(order.id),
                "order_number": order.order_number,
            },
            "success_url": settings.STRIPE_SUCCESS_URL,
            "cancel_url": settings.STRIPE_CANCEL_URL,
        },
    )

    session_id = str(_payment_value(session, "id", ""))
    checkout_url = str(_payment_value(session, "url", ""))
    livemode = bool(_payment_value(session, "livemode", False))
    publishable_key = str(_payment_value(session, "publishable_key", ""))

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
    payload_text = payload.decode("utf-8")
    response_payload = _payment_service_request(
        "/stripe/webhooks/verify",
        {
            "payload": payload_text,
            "signature": signature,
        },
    )
    event = response_payload.get("event")
    if not isinstance(event, dict):
        raise ValueError("Stripe payment service returned an invalid webhook event.")
    return event


def retrieve_stripe_checkout_session(session_id: str) -> StripeCheckoutSessionStatus:
    response_payload = _payment_service_request(
        "/stripe/checkout-sessions/retrieve",
        {"session_id": session_id},
    )
    result_session_id = str(response_payload.get("id") or session_id)
    return StripeCheckoutSessionStatus(
        session_id=result_session_id,
        payment_status=str(response_payload.get("payment_status") or ""),
        checkout_status=str(response_payload.get("status") or ""),
        payment_intent=str(response_payload.get("payment_intent") or ""),
        livemode=bool(response_payload.get("livemode", False)),
    )


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

    order, transaction_record = _get_order_and_transaction(order_id=order_id, session_id=session_id)
    success = event_type in STRIPE_SUCCESS_EVENT_TYPES
    return _apply_payment_result(
        order,
        transaction_record,
        session_id=session_id,
        payment_intent=payment_intent,
        success=success,
        event_type=event_type,
        event_id=event_id,
        checkout_status=str(session.get("status") or ""),
    )


def _get_order_and_transaction(
    *,
    order_id: str | int | None = None,
    session_id: str = "",
) -> tuple[Order, PaymentTransaction]:
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
            provider_reference=session_id or f"ord-{order.id}",
            amount=order.total_amount,
            status="pending",
            test_mode=True,
            raw_payload={},
        )

    return order, transaction_record


def _clear_reserved_cart_items_if_needed(order: Order, raw_payload: dict[str, Any]) -> dict[str, Any]:
    if raw_payload.get("cart_items_cleared"):
        return raw_payload

    if raw_payload.get("clear_entire_cart"):
        clear_checked_out_cart_items(order, None)
        raw_payload["cart_items_cleared"] = True
        return raw_payload

    selected_cart_item_ids = raw_payload.get("selected_cart_item_ids")
    if isinstance(selected_cart_item_ids, list):
        clear_checked_out_cart_items(order, [int(item_id) for item_id in selected_cart_item_ids])
        raw_payload["cart_items_cleared"] = True
    return raw_payload


def _apply_payment_result(
    order: Order,
    transaction_record: PaymentTransaction,
    *,
    session_id: str,
    payment_intent: str,
    success: bool,
    event_type: str,
    event_id: str = "",
    checkout_status: str = "",
) -> dict[str, Any]:
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

    if success:
        order.payment_status = Order.PaymentStatus.PAID
        order.payment_method = "stripe_checkout"
        if payment_intent:
            order.payment_reference = payment_intent
        elif session_id and not order.payment_reference:
            order.payment_reference = session_id
        order.save(update_fields=["payment_status", "payment_method", "payment_reference", "updated_at"])

        raw_payload = _clear_reserved_cart_items_if_needed(order, raw_payload)
        if not raw_payload.get("notifications_created"):
            create_order_notifications(order)
            raw_payload["notifications_created"] = True
    else:
        if order.payment_status != Order.PaymentStatus.PAID:
            order.payment_status = Order.PaymentStatus.FAILED
            order.payment_method = "stripe_checkout"
            order.status = Order.Status.CANCELLED
            if payment_intent:
                order.payment_reference = payment_intent
            elif session_id and not order.payment_reference:
                order.payment_reference = session_id
            order.save(
                update_fields=[
                    "payment_status",
                    "payment_method",
                    "payment_reference",
                    "status",
                    "updated_at",
                ]
            )
            order.sub_orders.exclude(status=Order.Status.DELIVERED).update(status=Order.Status.CANCELLED)
            if raw_payload.get("stock_reserved") and not raw_payload.get("stock_released"):
                release_stock_reservation_for_order(order)
                raw_payload["stock_released"] = True

    if event_id:
        processed_event_ids.append(event_id)
    raw_payload.update(
        {
            "checkout_session_id": session_id or raw_payload.get("checkout_session_id", ""),
            "payment_intent": payment_intent or raw_payload.get("payment_intent", ""),
            "last_event_id": event_id,
            "last_event_type": event_type,
            "livemode": False,
            "payment_status": order.payment_status,
            "checkout_status": checkout_status,
            "processed_event_ids": processed_event_ids,
        }
    )

    transaction_record.provider = "stripe"
    if session_id:
        transaction_record.provider_reference = session_id
    transaction_record.amount = order.total_amount
    transaction_record.status = "succeeded" if success else "failed"
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
def confirm_stripe_checkout_session(session_id: str) -> dict[str, Any]:
    session = retrieve_stripe_checkout_session(session_id)
    if session.livemode:
        raise ValueError("Stripe Checkout must run in test mode only.")

    order, transaction_record = _get_order_and_transaction(session_id=session_id)
    if session.payment_status == "paid" or session.checkout_status == "complete":
        result = _apply_payment_result(
            order,
            transaction_record,
            session_id=session.session_id,
            payment_intent=session.payment_intent,
            success=True,
            event_type="checkout.session.completed",
            checkout_status=session.checkout_status,
        )
        result["confirmed"] = True
        return result

    if session.checkout_status == "expired":
        result = _apply_payment_result(
            order,
            transaction_record,
            session_id=session.session_id,
            payment_intent=session.payment_intent,
            success=False,
            event_type="checkout.session.expired",
            checkout_status=session.checkout_status,
        )
        result["confirmed"] = False
        return result

    return {
        "confirmed": False,
        "handled": False,
        "event_type": "checkout.session.pending",
        "order_id": order.id,
        "payment_status": order.payment_status,
        "checkout_status": session.checkout_status,
    }


@transaction.atomic
def cancel_stripe_checkout_order(order: Order) -> dict[str, Any]:
    locked_order = Order.objects.select_for_update().get(pk=order.pk)
    transaction_record = PaymentTransaction.objects.select_for_update().filter(order=locked_order).first()
    if transaction_record is None:
        raise ValueError("No Stripe payment record exists for this order.")

    if locked_order.payment_status == Order.PaymentStatus.PAID:
        raise ValueError("Order is already paid.")

    result = _apply_payment_result(
        locked_order,
        transaction_record,
        session_id=transaction_record.provider_reference,
        payment_intent="",
        success=False,
        event_type="checkout.session.cancelled",
        checkout_status="cancelled",
    )
    result["cancelled"] = True
    return result


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
