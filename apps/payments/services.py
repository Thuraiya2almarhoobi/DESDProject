"""
DESD Marketplace documentation.

File role:
    Holds domain/service logic that should stay outside thin HTTP view classes.

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

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, PaymentTransaction, ProducerSubOrder
from apps.orders.services import (
    clear_checked_out_cart_items,
    create_order_notifications,
    release_stock_reservation_for_order,
)
from apps.producer_portal.models import OrderStatus, ProducerOrder

from .models import SettlementOrderLine, SettlementStatus, WeeklySettlement

# commission rate must match orders checkout snapshots
# settlements and admin reports depend on this staying at 5 percent
# customer totals do not add this on top
COMMISSION_RATE = Decimal("0.05")
STRIPE_SUCCESS_EVENT_TYPES = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
}
STRIPE_FAILURE_EVENT_TYPES = {
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
}
STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER = "{CHECKOUT_SESSION_ID}"


@dataclass(frozen=True)
class SettlementWeekRange:
    """
    Documents the `SettlementWeekRange` boundary for this module.

    The class belongs to the file role described above: Holds domain/service logic that should stay outside thin HTTP view classes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    start: date
    end: date


@dataclass(frozen=True)
class StripeCheckoutSessionResult:
    """
    Documents the `StripeCheckoutSessionResult` boundary for this module.

    The class belongs to the file role described above: Holds domain/service logic that should stay outside thin HTTP view classes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    session_id: str
    checkout_url: str
    publishable_key: str
    test_mode: bool


@dataclass(frozen=True)
class StripeCheckoutSessionStatus:
    """
    Documents the `StripeCheckoutSessionStatus` boundary for this module.

    The class belongs to the file role described above: Holds domain/service logic that should stay outside thin HTTP view classes.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
    session_id: str
    payment_status: str
    checkout_status: str
    payment_intent: str
    livemode: bool


def get_previous_week_range(reference_date: date | None = None) -> SettlementWeekRange:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `get_previous_week_range` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    reference_date = reference_date or timezone.localdate()
    current_week_monday = reference_date - timedelta(days=reference_date.weekday())
    previous_week_start = current_week_monday - timedelta(days=7)
    previous_week_end = current_week_monday - timedelta(days=1)
    return SettlementWeekRange(start=previous_week_start, end=previous_week_end)


def _money(value: Decimal) -> Decimal:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_money` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _money_to_minor_units(value: Decimal) -> int:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_money_to_minor_units` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    return int((_money(value) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _payment_value(obj: Any, key: str, default: Any = None) -> Any:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_payment_value` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _payment_service_base_url() -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_payment_service_base_url` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    base_url = (getattr(settings, "PAYMENT_SERVICE_BASE_URL", "") or "").strip().rstrip("/")
    if not base_url:
        raise ValueError("Stripe payment service is not configured.")
    return base_url


def _payment_service_headers() -> dict[str, str]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_payment_service_headers` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    headers = {"Content-Type": "application/json"}
    shared_secret = (getattr(settings, "PAYMENT_SERVICE_SHARED_SECRET", "") or "").strip()
    if shared_secret:
        headers["X-Payment-Service-Token"] = shared_secret
    return headers


def _payment_service_timeout() -> int:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_payment_service_timeout` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    return int(getattr(settings, "PAYMENT_SERVICE_TIMEOUT_SECONDS", 15))


def _payment_service_request(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_payment_service_request` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # stripe secrets stay inside the separate payment service
    # django sends an internal signed request and receives only safe checkout data
    # this keeps secret key handling out of the marketplace app
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_build_stripe_line_items` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # stripe receives rounded line totals rather than raw decimal quantities
    # this keeps kg and litre orders aligned with audited order totals
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


def _absolute_http_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return value.strip()


def _success_url_with_session_placeholder(url: str) -> str:
    if STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER in url:
        return url

    parsed = urlsplit(url)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    query.append(("session_id", STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER))
    encoded_query = urlencode(query).replace("%7BCHECKOUT_SESSION_ID%7D", STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, encoded_query, parsed.fragment))


def _stripe_checkout_redirect_urls(
    *,
    success_url: str | None = None,
    cancel_url: str | None = None,
) -> tuple[str, str]:
    # return urls are validated before they are sent to the payment service
    # the success url must carry the stripe session id for reconciliation
    resolved_success_url = _absolute_http_url(success_url) or settings.STRIPE_SUCCESS_URL
    resolved_cancel_url = _absolute_http_url(cancel_url) or settings.STRIPE_CANCEL_URL
    return _success_url_with_session_placeholder(resolved_success_url), resolved_cancel_url


@transaction.atomic
def create_stripe_checkout_session_for_order(
    order: Order,
    *,
    success_url: str | None = None,
    cancel_url: str | None = None,
) -> StripeCheckoutSessionResult:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `create_stripe_checkout_session_for_order` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # order exists before stripe redirect so stock can be reserved
    # webhook or success return later decides whether that reservation is kept
    if order.payment_status == Order.PaymentStatus.PAID:
        raise ValueError("Order is already paid.")

    redirect_success_url, redirect_cancel_url = _stripe_checkout_redirect_urls(
        success_url=success_url,
        cancel_url=cancel_url,
    )

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
            "success_url": redirect_success_url,
            "cancel_url": redirect_cancel_url,
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

    # payment transaction stores reconciliation flags for webhook idempotency
    # duplicate stripe events should not clear carts or notify producers twice
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `verify_and_construct_stripe_event` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # signature verification is delegated to the service that owns the webhook secret
    # this app only processes events after the payment service confirms them
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `retrieve_stripe_checkout_session` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # checkout success page asks for status so the ui does not wait for webhook retry
    # the webhook remains the durable backup if the browser return is skipped
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `handle_stripe_webhook_event` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # live stripe events are rejected so demo records cannot mix with real payments
    # this project is intentionally locked to test mode payment behaviour
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
    # webhooks may identify the order by order id or checkout session id
    # records are locked while resolving so retries cannot race each other
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_clear_reserved_cart_items_if_needed` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # cart deletion waits for payment success and uses an idempotency flag
    # selected checkout only clears selected cart rows after payment succeeds
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
    # this is the single success and failure reconciliation point
    # order status transaction status stock release and notifications meet here
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `confirm_stripe_checkout_session` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # success return confirms status immediately while webhook remains the backup
    # this makes the checkout page reliable during live demos
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `cancel_stripe_checkout_order` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # checkout cancel uses the same failure path as stripe expiry
    # stock release and transaction audit fields therefore stay identical
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `process_weekly_settlements` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.
    """
    # settlements group delivered paid work by producer for 5 percent commission reporting
    # this creates accounting records that separate gross sales commission and payout
    week_range = get_previous_week_range(reference_date)
    legacy_orders = (
        ProducerOrder.objects.select_related("producer")
        .filter(
            status=OrderStatus.DELIVERED,
            settlement_processed=False,
            delivery_date__date__gte=week_range.start,
            delivery_date__date__lte=week_range.end,
        )
        .order_by("producer_id", "delivery_date", "id")
    )
    marketplace_sub_orders = (
        ProducerSubOrder.objects.select_related("producer__user", "order", "order__customer")
        .filter(
            status=Order.Status.DELIVERED,
            settlement_processed=False,
            order__payment_status=Order.PaymentStatus.PAID,
            delivery_date__gte=week_range.start,
            delivery_date__lte=week_range.end,
            producer__user__isnull=False,
        )
        .order_by("producer__user_id", "delivery_date", "id")
    )

    by_producer: dict[int, dict[str, list]] = {}
    for order in legacy_orders:
        by_producer.setdefault(order.producer_id, {"legacy": [], "marketplace": []})["legacy"].append(order)
    for sub_order in marketplace_sub_orders:
        by_producer.setdefault(sub_order.producer.user_id, {"legacy": [], "marketplace": []})["marketplace"].append(sub_order)

    settlements: list[WeeklySettlement] = []

    for producer_id, rows in by_producer.items():
        # each settlement stores gross commission and net payout for accounting export
        # legacy producer orders and marketplace sub orders are merged by supplier
        orders = rows["legacy"]
        sub_orders = rows["marketplace"]
        gross_total = _money(
            sum((order.total_value for order in orders), Decimal("0.00"))
            + sum((sub_order.subtotal_amount for sub_order in sub_orders), Decimal("0.00"))
        )
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

        for sub_order in sub_orders:
            # marketplace sub order lines preserve the order level commission snapshot
            # this protects reports if the global rate changes in a later sprint
            SettlementOrderLine.objects.create(
                settlement=settlement,
                sub_order=sub_order,
                customer_name=(sub_order.order.customer.email or "Customer"),
                gross_amount=sub_order.subtotal_amount,
                commission_amount=sub_order.commission_amount,
                net_amount=sub_order.payout_amount,
            )
            sub_order.settlement_processed = True
            sub_order.save(update_fields=["settlement_processed", "updated_at"])

        settlements.append(settlement)

    return settlements
