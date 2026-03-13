from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
import logging
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from .models import (
    Cart,
    CartItem,
    CustomerProfile,
    Order,
    OrderItem,
    PaymentTransaction,
    Producer,
    ProducerNotification,
    ProducerSubOrder,
    UserNotification,
)

MONEY_Q = Decimal("0.01")
COMMISSION_RATE = Decimal("0.05")
logger = logging.getLogger("apps.orders")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_Q)


def get_or_create_cart(user) -> Cart:
    cart, _ = Cart.objects.get_or_create(customer=user)
    return cart


@dataclass
class CartProducerGroup:
    producer: Producer
    items: list[CartItem]
    subtotal: Decimal


def get_cart_groups(cart: Cart) -> list[CartProducerGroup]:
    grouped: dict[int, CartProducerGroup] = {}
    for item in cart.items.select_related("product__producer"):
        producer = item.product.producer
        if producer.id not in grouped:
            grouped[producer.id] = CartProducerGroup(producer=producer, items=[], subtotal=Decimal("0.00"))
        grouped[producer.id].items.append(item)
        grouped[producer.id].subtotal = money(grouped[producer.id].subtotal + item.line_total)
    return sorted(grouped.values(), key=lambda g: g.producer.business_name.lower())


def build_cart_payload(cart: Cart) -> dict:
    groups = get_cart_groups(cart)
    subtotal = money(sum((g.subtotal for g in groups), Decimal("0.00")))
    commission_amount = money(subtotal * COMMISSION_RATE)

    producer_groups = []
    item_count = Decimal("0.00")
    for group in groups:
        producer_groups.append(
            {
                "producer_id": group.producer.id,
                "producer_name": group.producer.business_name,
                "lead_time_hours": group.producer.lead_time_hours,
                "subtotal": group.subtotal,
                "items": [
                    {
                        "cart_item_id": item.id,
                        "product_id": item.product.id,
                        "product_name": item.product.name,
                        "category": item.product.category,
                        "unit": item.product.unit,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "line_total": item.line_total,
                        "available_stock": item.product.stock_quantity,
                    }
                    for item in group.items
                ],
            }
        )
        item_count += sum((item.quantity for item in group.items), Decimal("0.00"))

    return {
        "item_count": item_count,
        "producer_count": len(producer_groups),
        "subtotal": subtotal,
        "commission_rate": COMMISSION_RATE,
        "commission_amount": commission_amount,
        "total": subtotal,
        "groups": producer_groups,
    }


def validate_delivery_date(producer: Producer, selected_date: date) -> None:
    min_hours = max(48, producer.lead_time_hours)
    min_days = (min_hours + 23) // 24
    earliest = timezone.localdate() + timedelta(days=min_days)
    if selected_date < earliest:
        raise ValueError(
            f"Delivery date for {producer.business_name} must be at least {min_hours} hours in advance."
        )


def _resolve_delivery_dates(groups: list[CartProducerGroup], payload: dict) -> dict[int, date]:
    delivery_date = payload.get("delivery_date")
    producer_delivery_dates = payload.get("producer_delivery_dates") or {}
    resolved: dict[int, date] = {}

    if len(groups) == 1 and delivery_date and not producer_delivery_dates:
        resolved[groups[0].producer.id] = delivery_date
    else:
        for group in groups:
            key = str(group.producer.id)
            if key not in producer_delivery_dates:
                raise ValueError(
                    f"Missing delivery date for producer {group.producer.business_name}."
                )
            resolved[group.producer.id] = producer_delivery_dates[key]

    for group in groups:
        validate_delivery_date(group.producer, resolved[group.producer.id])
    return resolved


@transaction.atomic
def checkout_cart(user, payload: dict) -> Order:
    cart = get_or_create_cart(user)
    groups = get_cart_groups(cart)

    if not groups:
        raise ValueError("Cart is empty.")

    special_instructions = (payload.get("special_instructions") or "").strip()

    for group in groups:
        for item in group.items:
            if not item.product.is_available or item.product.stock_quantity < item.quantity:
                raise ValueError(f"Product '{item.product.name}' is unavailable in requested quantity.")

    delivery_dates = _resolve_delivery_dates(groups, payload)

    subtotal = money(sum((group.subtotal for group in groups), Decimal("0.00")))
    commission_amount = money(subtotal * COMMISSION_RATE)
    payout_total = money(subtotal - commission_amount)

    order = Order.objects.create(
        customer=user,
        delivery_address=payload["delivery_address"],
        customer_postcode=payload["customer_postcode"],
        subtotal_amount=subtotal,
        commission_rate=COMMISSION_RATE,
        commission_amount=commission_amount,
        total_amount=subtotal,
        producer_payout_total=payout_total,
        payment_method=payload.get("payment_method", "test_card"),
        payment_reference=f"PAY-{uuid4().hex[:10].upper()}",
        payment_status=Order.PaymentStatus.PAID,
        status=Order.Status.PENDING,
        special_instructions=special_instructions,
    )

    for group in groups:
        producer_commission = money(group.subtotal * COMMISSION_RATE)
        payout_amount = money(group.subtotal - producer_commission)
        sub_order = ProducerSubOrder.objects.create(
            order=order,
            producer=group.producer,
            delivery_date=delivery_dates[group.producer.id],
            subtotal_amount=group.subtotal,
            commission_amount=producer_commission,
            payout_amount=payout_amount,
            status=Order.Status.PENDING,
            notes=special_instructions,
        )

        for item in group.items:
            OrderItem.objects.create(
                order=order,
                sub_order=sub_order,
                product=item.product,
                product_name=item.product.name,
                producer_name=group.producer.business_name,
                unit=item.product.unit,
                quantity=item.quantity,
                unit_price=item.product.price,
                line_total=item.line_total,
            )
            item.product.stock_quantity = money(item.product.stock_quantity - item.quantity)
            if item.product.stock_quantity <= Decimal("0.00"):
                item.product.is_available = False
            item.product.save(update_fields=["stock_quantity", "is_available", "updated_at"])

        ProducerNotification.objects.create(
            producer=group.producer,
            sub_order=sub_order,
            message=(
                f"New order {order.order_number} for {group.producer.business_name} "
                f"(delivery {delivery_dates[group.producer.id]}, lead time {group.producer.lead_time_hours}h)"
            ),
        )
        logger.info(
            "producer_notification_created order=%s producer=%s lead_time_hours=%s special_instructions=%s",
            order.order_number,
            group.producer.business_name,
            group.producer.lead_time_hours,
            special_instructions[:120],
        )

    PaymentTransaction.objects.create(
        order=order,
        provider="mock",
        provider_reference=order.payment_reference,
        amount=order.total_amount,
        status="succeeded",
        test_mode=True,
        raw_payload={"payment_token": payload.get("payment_token", "")},
    )

    CustomerProfile.objects.update_or_create(
        user=user,
        defaults={
            "delivery_address": payload["delivery_address"],
            "postcode": payload["customer_postcode"],
        },
    )

    if getattr(user, "role", None) in {"COMMUNITY", "RESTAURANT"}:
        UserNotification.objects.create(
            user=user,
            category="order_confirmation",
            message=f"Order {order.order_number} placed successfully.",
            metadata={
                "order_id": order.id,
                "producer_count": len(groups),
                "special_instructions": special_instructions,
            },
        )

    cart.items.all().delete()
    return order


@transaction.atomic
def reorder_order_to_cart(user, order: Order) -> dict:
    cart = get_or_create_cart(user)
    unavailable: list[dict] = []
    added: list[dict] = []

    for item in order.items.select_related("product"):
        if item.product is None:
            unavailable.append(
                {"product_name": item.product_name, "reason": "Product no longer exists."}
            )
            continue

        product = item.product
        if not product.is_available or product.stock_quantity <= Decimal("0.00"):
            unavailable.append({"product_name": product.name, "reason": "Product unavailable."})
            continue

        quantity_to_add = min(item.quantity, product.stock_quantity)
        if quantity_to_add <= Decimal("0.00"):
            unavailable.append({"product_name": product.name, "reason": "Out of stock."})
            continue

        cart_item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, defaults={"quantity": quantity_to_add}
        )
        if not created:
            new_qty = cart_item.quantity + quantity_to_add
            if new_qty > product.stock_quantity:
                new_qty = product.stock_quantity
            cart_item.quantity = money(new_qty)
            cart_item.save(update_fields=["quantity", "updated_at"])

        added.append({"product_id": product.id, "product_name": product.name, "quantity": quantity_to_add})

    return {
        "added_items": added,
        "unavailable_items": unavailable,
        "cart": build_cart_payload(cart),
    }
