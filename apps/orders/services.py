from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_CEILING
import logging
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from .marketplace_sync import sync_catalog_product_from_orders_product
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


def get_cart_groups(cart: Cart, selected_cart_item_ids: list[int] | None = None) -> list[CartProducerGroup]:
    grouped: dict[int, CartProducerGroup] = {}
    item_queryset = cart.items.select_related("product__producer")
    if selected_cart_item_ids is not None:
        item_queryset = item_queryset.filter(id__in=selected_cart_item_ids)

    for item in item_queryset:
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


def _selected_cart_item_ids(cart: Cart, payload: dict) -> list[int] | None:
    selected_cart_item_ids = payload.get("selected_cart_item_ids")
    if selected_cart_item_ids is None:
        return None

    unique_selected_ids = sorted({int(item_id) for item_id in selected_cart_item_ids})
    matching_count = cart.items.filter(id__in=unique_selected_ids).count()
    if matching_count != len(unique_selected_ids):
        raise ValueError("One or more selected cart items are invalid.")
    return unique_selected_ids


def _prepare_checkout_state(
    user, payload: dict
) -> tuple[Cart, list[int] | None, list[CartProducerGroup], str, dict[int, date]]:
    cart = get_or_create_cart(user)
    unique_selected_ids = _selected_cart_item_ids(cart, payload)
    groups = get_cart_groups(cart, unique_selected_ids)

    if not groups:
        if not cart.items.exists():
            raise ValueError("Cart is empty.")
        raise ValueError("Select at least one cart item to checkout.")

    special_instructions = (payload.get("special_instructions") or "").strip()

    for group in groups:
        for item in group.items:
            if not item.product.is_available or item.product.stock_quantity < item.quantity:
                raise ValueError(f"Product '{item.product.name}' is unavailable in requested quantity.")

    delivery_dates = _resolve_delivery_dates(groups, payload)
    return cart, unique_selected_ids, groups, special_instructions, delivery_dates


def _create_order_record(
    user,
    payload: dict,
    groups: list[CartProducerGroup],
    special_instructions: str,
    *,
    payment_method: str,
    payment_reference: str,
    payment_status: str,
) -> Order:
    subtotal = money(sum((group.subtotal for group in groups), Decimal("0.00")))
    commission_amount = money(subtotal * COMMISSION_RATE)
    payout_total = money(subtotal - commission_amount)

    return Order.objects.create(
        customer=user,
        delivery_address=payload["delivery_address"],
        customer_postcode=payload["customer_postcode"],
        subtotal_amount=subtotal,
        commission_rate=COMMISSION_RATE,
        commission_amount=commission_amount,
        total_amount=subtotal,
        producer_payout_total=payout_total,
        payment_method=payment_method,
        payment_reference=payment_reference,
        payment_status=payment_status,
        status=Order.Status.PENDING,
        special_instructions=special_instructions,
    )


def _create_order_structure(
    order: Order, groups: list[CartProducerGroup], delivery_dates: dict[int, date], special_instructions: str
) -> None:
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


def _producer_portal_stock_units(quantity: Decimal) -> int:
    whole_units = quantity.to_integral_value()
    if quantity == whole_units:
        return int(whole_units)
    return int(quantity.to_integral_value(rounding=ROUND_CEILING))


def _matching_producer_portal_product(order_item: OrderItem):
    producer_user = getattr(getattr(order_item.product, "producer", None), "user", None)
    if producer_user is None:
        return None

    from apps.producer_portal.models import ProducerProduct

    producer_product = (
        ProducerProduct.objects.select_for_update()
        .filter(
            producer=producer_user,
            name=order_item.product_name,
            unit=order_item.unit,
        )
        .order_by("-updated_at", "-id")
        .first()
    )
    if producer_product is not None:
        return producer_product

    return (
        ProducerProduct.objects.select_for_update()
        .filter(
            producer=producer_user,
            name=order_item.product_name,
        )
        .order_by("-updated_at", "-id")
        .first()
    )


def _adjust_order_product_stock(order_item: OrderItem, quantity_delta: Decimal) -> None:
    if order_item.product is None:
        return

    next_stock = money(order_item.product.stock_quantity + quantity_delta)
    if next_stock < Decimal("0.00"):
        raise ValueError(f"Product '{order_item.product_name}' no longer has enough stock.")

    order_item.product.stock_quantity = next_stock
    order_item.product.is_available = next_stock > Decimal("0.00")
    order_item.product.save(update_fields=["stock_quantity", "is_available", "updated_at"])
    sync_catalog_product_from_orders_product(order_item.product)


def _adjust_producer_portal_stock(order_item: OrderItem, quantity_delta: Decimal) -> None:
    producer_product = _matching_producer_portal_product(order_item)
    if producer_product is None:
        return

    units_delta = _producer_portal_stock_units(abs(quantity_delta))
    if units_delta <= 0:
        return

    if quantity_delta < Decimal("0.00"):
        next_stock = producer_product.stock_quantity - units_delta
        if next_stock < 0:
            raise ValueError(f"Producer inventory for '{order_item.product_name}' is no longer available.")
    else:
        next_stock = producer_product.stock_quantity + units_delta

    producer_product.stock_quantity = next_stock
    producer_product.save(update_fields=["stock_quantity", "updated_at"])


def reserve_stock_for_order(order: Order) -> None:
    for order_item in order.items.select_related("product__producer__user").all():
        _adjust_order_product_stock(order_item, -order_item.quantity)
        _adjust_producer_portal_stock(order_item, -order_item.quantity)


def release_stock_reservation_for_order(order: Order) -> None:
    for order_item in order.items.select_related("product__producer__user").all():
        _adjust_order_product_stock(order_item, order_item.quantity)
        _adjust_producer_portal_stock(order_item, order_item.quantity)


def clear_checked_out_cart_items(order: Order, selected_cart_item_ids: list[int] | None) -> None:
    cart = Cart.objects.filter(customer=order.customer).first()
    if cart is None:
        return
    if selected_cart_item_ids is None:
        cart.items.all().delete()
    else:
        cart.items.filter(id__in=selected_cart_item_ids).delete()


def create_order_notifications(order: Order) -> None:
    special_instructions = order.special_instructions.strip()
    for sub_order in order.sub_orders.select_related("producer").all():
        ProducerNotification.objects.get_or_create(
            producer=sub_order.producer,
            sub_order=sub_order,
            defaults={
                "message": (
                    f"New order {order.order_number} for {sub_order.producer.business_name} "
                    f"(delivery {sub_order.delivery_date}, lead time {sub_order.producer.lead_time_hours}h)"
                )
            },
        )
        logger.info(
            "producer_notification_created order=%s producer=%s lead_time_hours=%s special_instructions=%s",
            order.order_number,
            sub_order.producer.business_name,
            sub_order.producer.lead_time_hours,
            special_instructions[:120],
        )

    if getattr(order.customer, "role", None) in {"COMMUNITY", "RESTAURANT"}:
        UserNotification.objects.get_or_create(
            user=order.customer,
            category="order_confirmation",
            message=f"Order {order.order_number} placed successfully.",
            defaults={
                "metadata": {
                    "order_id": order.id,
                    "producer_count": order.sub_orders.count(),
                    "special_instructions": special_instructions,
                }
            },
        )


@transaction.atomic
def checkout_cart_with_stripe_reservation(user, payload: dict) -> Order:
    _, unique_selected_ids, groups, special_instructions, delivery_dates = _prepare_checkout_state(user, payload)
    order = _create_order_record(
        user,
        payload,
        groups,
        special_instructions,
        payment_method="stripe_checkout",
        payment_reference="",
        payment_status=Order.PaymentStatus.PENDING,
    )
    _create_order_structure(order, groups, delivery_dates, special_instructions)
    reserve_stock_for_order(order)

    PaymentTransaction.objects.create(
        order=order,
        provider="stripe",
        provider_reference=f"pending-{uuid4().hex[:12]}",
        amount=order.total_amount,
        status="pending",
        test_mode=True,
        raw_payload={
            "selected_cart_item_ids": unique_selected_ids or [],
            "clear_entire_cart": unique_selected_ids is None,
            "stock_reserved": True,
            "stock_released": False,
            "notifications_created": False,
        },
    )

    CustomerProfile.objects.update_or_create(
        user=user,
        defaults={
            "delivery_address": payload["delivery_address"],
            "postcode": payload["customer_postcode"],
        },
    )

    return order


@transaction.atomic
def checkout_cart(user, payload: dict) -> Order:
    _, unique_selected_ids, groups, special_instructions, delivery_dates = _prepare_checkout_state(user, payload)
    order = _create_order_record(
        user,
        payload,
        groups,
        special_instructions,
        payment_method=payload.get("payment_method", "test_card"),
        payment_reference=f"PAY-{uuid4().hex[:10].upper()}",
        payment_status=Order.PaymentStatus.PAID,
    )
    _create_order_structure(order, groups, delivery_dates, special_instructions)

    reserve_stock_for_order(order)

    create_order_notifications(order)

    PaymentTransaction.objects.create(
        order=order,
        provider="mock",
        provider_reference=order.payment_reference,
        amount=order.total_amount,
        status="succeeded",
        test_mode=True,
        raw_payload={
            "payment_token": payload.get("payment_token", ""),
            "stock_reserved": True,
            "stock_released": False,
        },
    )

    CustomerProfile.objects.update_or_create(
        user=user,
        defaults={
            "delivery_address": payload["delivery_address"],
            "postcode": payload["customer_postcode"],
        },
    )

    clear_checked_out_cart_items(order, unique_selected_ids)
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


