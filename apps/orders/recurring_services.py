"""
DESD Marketplace documentation.

File role:
    Implements scheduling rules for restaurant/community recurring orders without placing that logic in views.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

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
from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from .models import (
    Order,
    OrderItem,
    PaymentTransaction,
    ProducerNotification,
    ProducerSubOrder,
    RecurringOrderInstanceOverride,
    RecurringOrderInstanceOverrideItem,
    RecurringOrderTemplate,
    RecurringOrderTemplateItem,
    UserNotification,
)
from .services import (
    COMMISSION_RATE,
    checkout_cart,
    checkout_cart_with_stripe_reservation,
    get_cart_groups,
    get_or_create_cart,
    money,
)


@dataclass
class GeneratedRecurringOrderResult:
    """
    Documents the `GeneratedRecurringOrderResult` boundary for this module.

    The class belongs to the file role described above: Implements scheduling rules for restaurant/community recurring orders without placing that logic in views.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    template_id: int
    scheduled_order_date: date
    order_id: int | None
    unavailable_products: list[dict]


def _frequency_days(frequency: str) -> int:
    """
    Helper for the file role: Implements scheduling rules for restaurant/community recurring orders without placing that logic in views.

    `_frequency_days` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    if frequency == RecurringOrderTemplate.Frequency.FORTNIGHTLY:
        return 14
    return 7


def advance_template_schedule(template: RecurringOrderTemplate, scheduled_order_date: date) -> None:
    """
    Helper for the file role: Implements scheduling rules for restaurant/community recurring orders without placing that logic in views.

    `advance_template_schedule` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    template.next_order_date = scheduled_order_date + timedelta(
        days=_frequency_days(template.frequency)
    )
    template.last_generated_at = timezone.now()
    template.save(update_fields=["next_order_date", "last_generated_at", "updated_at"])


def _next_weekday(base_date: date, weekday: int) -> date:
    """
    Helper for the file role: Implements scheduling rules for restaurant/community recurring orders without placing that logic in views.

    `_next_weekday` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    delta = (weekday - base_date.weekday()) % 7
    if delta == 0:
        delta = 7
    return base_date + timedelta(days=delta)


def _delivery_offset_days(order_day: int, delivery_day: int) -> int:
    """
    Helper for the file role: Implements scheduling rules for restaurant/community recurring orders without placing that logic in views.

    `_delivery_offset_days` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    offset = (delivery_day - order_day) % 7
    return offset or 7


def _delivery_date_for_producer(
    template: RecurringOrderTemplate,
    producer,
    scheduled_order_date: date,
) -> date:
    candidate = scheduled_order_date + timedelta(
        days=_delivery_offset_days(template.order_day, template.delivery_day)
    )
    min_hours = max(48, producer.lead_time_hours)
    min_days = (min_hours + 23) // 24
    earliest = timezone.localdate() + timedelta(days=min_days)
    return max(candidate, earliest)


def _build_template_item_rows_from_cart(
    user,
    selected_cart_item_ids: list[int] | None = None,
) -> list[dict]:
    cart = get_or_create_cart(user)
    groups = get_cart_groups(cart, selected_cart_item_ids)
    rows: list[dict] = []
    for group in groups:
        for item in group.items:
            rows.append(
                {
                    "product": item.product,
                    "quantity": item.quantity,
                }
            )
    return rows


@transaction.atomic
def create_recurring_template_from_checkout(
    user,
    payload: dict,
    *,
    reserve_payment: bool = False,
) -> tuple[RecurringOrderTemplate, Order]:
    selected_cart_item_ids = payload.get("selected_cart_item_ids")
    item_rows = _build_template_item_rows_from_cart(user, selected_cart_item_ids)
    if not item_rows:
        raise ValueError("Cart is empty.")

    initial_order = (
        checkout_cart_with_stripe_reservation(user, payload)
        if reserve_payment
        else checkout_cart(user, payload)
    )

    today = timezone.localdate()
    next_order_date = _next_weekday(today, int(payload["order_day"]))

    template = RecurringOrderTemplate.objects.create(
        restaurant=user,
        frequency=payload["frequency"],
        order_day=payload["order_day"],
        delivery_day=payload["delivery_day"],
        next_order_date=next_order_date,
        delivery_address=payload["delivery_address"],
        customer_postcode=payload["customer_postcode"],
        payment_method=payload.get("payment_method") or ("stripe_checkout" if reserve_payment else "test_card"),
    )

    RecurringOrderTemplateItem.objects.bulk_create(
        [
            RecurringOrderTemplateItem(
                template=template,
                product=row["product"],
                default_quantity=row["quantity"],
            )
            for row in item_rows
        ]
    )

    initial_order.recurring_template = template
    initial_order.is_recurring_instance = True
    initial_order.recurring_scheduled_for = today
    initial_order.save(
        update_fields=[
            "recurring_template",
            "is_recurring_instance",
            "recurring_scheduled_for",
            "updated_at",
        ]
    )

    return template, initial_order


@transaction.atomic
def set_next_instance_override(
    template: RecurringOrderTemplate,
    override_items: list[dict],
    *,
    created_by=None,
) -> RecurringOrderInstanceOverride:
    template_items = list(template.items.select_related("product").all())
    template_item_product_ids = {item.product_id for item in template_items}
    template_products = {item.product_id: item.product for item in template_items}

    for row in override_items:
        if row["product_id"] not in template_item_product_ids:
            raise ValueError("Override product must exist in the recurring template.")
        product = template_products[row["product_id"]]
        if row["quantity"] > product.stock_quantity:
            raise ValueError(
                f"{product.name} only has {product.stock_quantity.quantize(Decimal('0.01'))} {product.unit} available."
            )

    override, _ = RecurringOrderInstanceOverride.objects.update_or_create(
        template=template,
        scheduled_order_date=template.next_order_date,
        defaults={"created_by": created_by},
    )
    override.items.all().delete()
    RecurringOrderInstanceOverrideItem.objects.bulk_create(
        [
            RecurringOrderInstanceOverrideItem(
                override=override,
                product_id=row["product_id"],
                quantity=row["quantity"],
            )
            for row in override_items
        ]
    )
    return override


def _build_item_quantities(
    template: RecurringOrderTemplate,
    scheduled_order_date: date,
) -> tuple[list[dict], list[dict]]:
    template_items = list(
        template.items.select_related("product__producer").all()
    )
    quantities = {
        item.product_id: item.default_quantity for item in template_items
    }

    override = (
        template.instance_overrides.filter(scheduled_order_date=scheduled_order_date)
        .prefetch_related("items")
        .first()
    )
    if override:
        for row in override.items.all():
            quantities[row.product_id] = row.quantity

    chosen: list[dict] = []
    unavailable: list[dict] = []
    for template_item in template_items:
        product = template_item.product
        quantity = quantities.get(product.id, template_item.default_quantity)
        if not product.is_orderable() or product.stock_quantity < quantity:
            unavailable.append(
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "requested_quantity": str(quantity),
                    "available_stock": str(product.stock_quantity),
                    "reason": (
                        "Product out of season."
                        if product.is_available and product.stock_quantity >= quantity
                        else "Product unavailable for current template quantity."
                    ),
                }
            )
            continue
        chosen.append(
            {
                "product": product,
                "producer": product.producer,
                "quantity": quantity,
                "unit_price": product.price,
                "line_total": money(product.price * quantity),
            }
        )
    return chosen, unavailable


@transaction.atomic
def generate_order_for_template(
    template: RecurringOrderTemplate,
    scheduled_order_date: date,
) -> GeneratedRecurringOrderResult:
    selected_items, unavailable = _build_item_quantities(template, scheduled_order_date)
    if not selected_items:
        UserNotification.objects.create(
            user=template.restaurant,
            category="recurring_order_alert",
            message="Recurring order skipped because all items were unavailable.",
            metadata={
                "template_id": template.id,
                "scheduled_order_date": scheduled_order_date.isoformat(),
                "unavailable_products": unavailable,
            },
        )
        return GeneratedRecurringOrderResult(
            template_id=template.id,
            scheduled_order_date=scheduled_order_date,
            order_id=None,
            unavailable_products=unavailable,
        )

    grouped: dict[int, dict] = {}
    for row in selected_items:
        producer_id = row["producer"].id
        if producer_id not in grouped:
            grouped[producer_id] = {
                "producer": row["producer"],
                "items": [],
                "subtotal": Decimal("0.00"),
            }
        grouped[producer_id]["items"].append(row)
        grouped[producer_id]["subtotal"] = money(
            grouped[producer_id]["subtotal"] + row["line_total"]
        )

    subtotal = money(sum((group["subtotal"] for group in grouped.values()), Decimal("0.00")))
    commission_amount = money(subtotal * COMMISSION_RATE)
    payout_total = money(subtotal - commission_amount)

    order = Order.objects.create(
        customer=template.restaurant,
        recurring_template=template,
        recurring_scheduled_for=scheduled_order_date,
        is_recurring_instance=True,
        status=Order.Status.PENDING,
        payment_status=Order.PaymentStatus.PAID,
        delivery_address=template.delivery_address,
        customer_postcode=template.customer_postcode,
        subtotal_amount=subtotal,
        commission_rate=COMMISSION_RATE,
        commission_amount=commission_amount,
        total_amount=subtotal,
        producer_payout_total=payout_total,
        payment_method=template.payment_method or "test_card",
        payment_reference=f"PAY-{uuid4().hex[:10].upper()}",
        special_instructions="Recurring order instance",
    )

    for group in grouped.values():
        producer = group["producer"]
        producer_commission = money(group["subtotal"] * COMMISSION_RATE)
        payout_amount = money(group["subtotal"] - producer_commission)
        sub_order = ProducerSubOrder.objects.create(
            order=order,
            producer=producer,
            status=Order.Status.PENDING,
            delivery_date=_delivery_date_for_producer(template, producer, scheduled_order_date),
            subtotal_amount=group["subtotal"],
            commission_amount=producer_commission,
            payout_amount=payout_amount,
            notes="Generated from recurring order template.",
        )

        for line in group["items"]:
            product = line["product"]
            quantity = line["quantity"]
            OrderItem.objects.create(
                order=order,
                sub_order=sub_order,
                product=product,
                product_name=product.name,
                producer_name=producer.business_name,
                unit=product.unit,
                quantity=quantity,
                unit_price=line["unit_price"],
                line_total=line["line_total"],
            )
            product.stock_quantity = money(product.stock_quantity - quantity)
            if product.stock_quantity <= Decimal("0.00"):
                product.is_available = False
            product.save(update_fields=["stock_quantity", "is_available", "updated_at"])

        ProducerNotification.objects.create(
            producer=producer,
            sub_order=sub_order,
            message=(
                f"Advance notice: recurring order {order.order_number} "
                f"(delivery {sub_order.delivery_date}, lead time {producer.lead_time_hours}h)"
            ),
        )

    PaymentTransaction.objects.create(
        order=order,
        provider="mock",
        provider_reference=order.payment_reference,
        amount=order.total_amount,
        status="succeeded",
        test_mode=True,
        raw_payload={"source": "recurring_generator"},
    )

    UserNotification.objects.create(
        user=template.restaurant,
        category="recurring_order_generated",
        message=f"Recurring order {order.order_number} has been generated.",
        metadata={
            "template_id": template.id,
            "order_id": order.id,
            "scheduled_order_date": scheduled_order_date.isoformat(),
            "unavailable_products": unavailable,
        },
    )

    template.instance_overrides.filter(scheduled_order_date=scheduled_order_date).delete()
    return GeneratedRecurringOrderResult(
        template_id=template.id,
        scheduled_order_date=scheduled_order_date,
        order_id=order.id,
        unavailable_products=unavailable,
    )


@transaction.atomic
def generate_due_recurring_orders(
    *,
    run_date: date | None = None,
) -> list[GeneratedRecurringOrderResult]:
    today = run_date or timezone.localdate()
    templates = (
        RecurringOrderTemplate.objects.filter(
            is_paused=False,
            is_cancelled=False,
            next_order_date__lte=today,
        )
        .select_related("restaurant")
        .prefetch_related("items__product__producer")
        .order_by("id")
    )

    results: list[GeneratedRecurringOrderResult] = []
    for template in templates:
        scheduled_order_date = template.next_order_date
        result = generate_order_for_template(template, scheduled_order_date)
        results.append(result)
        advance_template_schedule(template, scheduled_order_date)
    return results


def build_template_alerts(template: RecurringOrderTemplate) -> list[dict]:
    """
    Helper for the file role: Implements scheduling rules for restaurant/community recurring orders without placing that logic in views.

    `build_template_alerts` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    alerts = []
    for item in template.items.select_related("product").all():
        if not item.product.is_orderable() or item.product.stock_quantity < item.default_quantity:
            alerts.append(
                {
                    "product_id": item.product_id,
                    "product_name": item.product.name,
                    "available_stock": str(item.product.stock_quantity),
                    "required_quantity": str(item.default_quantity),
                    "reason": (
                        "Product out of season for the current template date."
                        if item.product.is_available and item.product.stock_quantity >= item.default_quantity
                        else "Product unavailable for current template quantity."
                    ),
                }
            )
    return alerts
