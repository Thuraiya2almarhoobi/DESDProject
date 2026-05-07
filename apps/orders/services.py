"""
DESD Marketplace documentation.

File role:
    Holds domain/service logic that should stay outside thin HTTP view classes.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_CEILING
import logging
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from .marketplace_sync import (
    default_marketplace_image_url,
    effective_product_unit_price,
    product_has_active_surplus_deal,
    sync_catalog_product_from_orders_product,
)
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
    ProductAllergenAcknowledgement,
    UserNotification,
)

MONEY_Q = Decimal("0.01")
# tc-025 depends on this exact 5% network commission
# keep this aligned with payments so checkout stripe settlements and reports agree
COMMISSION_RATE = Decimal("0.05")
# buyer quantity is also validated against live product stock
# this is the extra bulk order safety cap for community and restaurant buyers
MAX_ORDER_ITEM_QUANTITY = Decimal("100.00")
logger = logging.getLogger("apps.orders")


def money(value: Decimal) -> Decimal:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `money` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    return value.quantize(MONEY_Q)


def cart_item_unit_price(item: CartItem) -> Decimal:
    # surplus pricing is resolved here so cart and checkout share the same unit price
    return effective_product_unit_price(item.product)


def cart_item_line_total(item: CartItem) -> Decimal:
    # every line total is rounded before it is added to order and commission totals
    return money(cart_item_unit_price(item) * item.quantity)


def get_or_create_cart(user) -> Cart:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `get_or_create_cart` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # every buyer has one live cart so cart state can survive page changes
    cart, _ = Cart.objects.get_or_create(customer=user)
    return cart


@dataclass
class CartProducerGroup:
    """
    Documents the `CartProducerGroup` boundary for this module.

    The class belongs to the file role described above: Holds domain/service logic that should stay outside thin HTTP view classes.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer: Producer
    items: list[CartItem]
    subtotal: Decimal


def get_cart_groups(cart: Cart, selected_cart_item_ids: list[int] | None = None) -> list[CartProducerGroup]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `get_cart_groups` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # cart checkout and delivery date rules all operate by producer
    grouped: dict[int, CartProducerGroup] = {}
    item_queryset = cart.items.select_related("product__producer")
    if selected_cart_item_ids is not None:
        item_queryset = item_queryset.filter(id__in=selected_cart_item_ids)

    for item in item_queryset:
        producer = item.product.producer
        if producer.id not in grouped:
            grouped[producer.id] = CartProducerGroup(producer=producer, items=[], subtotal=Decimal("0.00"))
        grouped[producer.id].items.append(item)
        grouped[producer.id].subtotal = money(grouped[producer.id].subtotal + cart_item_line_total(item))
    return sorted(grouped.values(), key=lambda g: g.producer.business_name.lower())


def build_cart_payload(cart: Cart) -> dict:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `build_cart_payload` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # browser displays this payload but money rules stay on the backend
    # surplus discounts and commission totals are calculated once here
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
                        "unit_price": cart_item_unit_price(item),
                        "line_total": cart_item_line_total(item),
                        "original_unit_price": item.product.price,
                        "image_url": item.product.image_url or default_marketplace_image_url(item.product.id),
                        "allergen_info": item.product.allergen_info,
                        "is_organic": item.product.is_organic,
                        "organic_certification": item.product.organic_certification,
                        "is_surplus": product_has_active_surplus_deal(item.product),
                        "surplus_discount_percent": item.product.surplus_discount_percent if product_has_active_surplus_deal(item.product) else None,
                        "surplus_best_before": item.product.surplus_best_before,
                        "surplus_note": item.product.surplus_note,
                        "available_stock": item.product.stock_quantity,
                        "availability": item.product.effective_availability(),
                        "seasonal_dates": item.product.seasonal_window_label or ("Current season" if item.product.in_season else "Year-round"),
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `validate_delivery_date` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    min_hours = max(48, producer.lead_time_hours)
    min_days = (min_hours + 23) // 24
    earliest = timezone.localdate() + timedelta(days=min_days)
    if selected_date < earliest:
        raise ValueError(
            f"Delivery date for {producer.business_name} must be at least {min_hours} hours in advance."
        )


def _resolve_delivery_dates(groups: list[CartProducerGroup], payload: dict) -> dict[int, date]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_resolve_delivery_dates` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_selected_cart_item_ids` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    selected_cart_item_ids = payload.get("selected_cart_item_ids")
    if selected_cart_item_ids is None:
        return None

    # selected checkout must only remove the chosen cart items after order create
    unique_selected_ids = sorted({int(item_id) for item_id in selected_cart_item_ids})
    matching_count = cart.items.filter(id__in=unique_selected_ids).count()
    if matching_count != len(unique_selected_ids):
        raise ValueError("One or more selected cart items are invalid.")
    return unique_selected_ids


def _prepare_checkout_state(
    user, payload: dict
) -> tuple[Cart, list[int] | None, list[CartProducerGroup], str, dict[int, date]]:
    """Validate the cart immediately before an order/Stripe reservation is created."""
    # checkout validation runs as late as possible to catch stale cart data
    cart = get_or_create_cart(user)
    unique_selected_ids = _selected_cart_item_ids(cart, payload)
    groups = get_cart_groups(cart, unique_selected_ids)

    if not groups:
        if not cart.items.exists():
            raise ValueError("Cart is empty.")
        raise ValueError("Select at least one cart item to checkout.")

    special_instructions = (payload.get("special_instructions") or "").strip()

    # stock is checked late so stale cart quantities cannot slip into orders
    # this prevents out of stock purchases even if the cart page is stale
    for group in groups:
        for item in group.items:
            if not item.product.is_orderable() or item.product.stock_quantity < item.quantity:
                reason = "is out of season" if item.product.is_available and item.product.stock_quantity > 0 else "is unavailable"
                raise ValueError(f"Product '{item.product.name}' {reason} in the requested quantity.")
            allergens = [
                token.strip()
                for token in (item.product.allergen_info or "").split(",")
                if token.strip() and token.strip().lower() not in {"no common allergens", "none", "no allergens"}
            ]
            # allergen acknowledgement lives server side so checkout is not just local storage
            if allergens and not ProductAllergenAcknowledgement.objects.filter(
                user=user,
                product=item.product,
            ).exists():
                raise ValueError(
                    f"Review allergen information for '{item.product.name}' before checkout."
                )

    delivery_dates = _resolve_delivery_dates(groups, payload)

    from apps.geo.services import get_cart_food_miles

    food_miles = get_cart_food_miles(
        user,
        postcode=payload["customer_postcode"],
        selected_cart_item_ids=unique_selected_ids,
    )
    # the twenty mile rule is enforced before order creation so bad addresses do not create records
    max_distance = max(
        (Decimal(str(row["distance_miles"])) for row in food_miles.get("producer_totals", [])),
        default=Decimal("0.00"),
    )
    if max_distance > Decimal("20.00"):
        raise ValueError(
            "Delivery address is outside the Bristol Regional Food Network 20-mile radius."
        )
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
    # order totals are snapshotted so admin reports remain auditable later
    subtotal = money(sum((group.subtotal for group in groups), Decimal("0.00")))
    commission_amount = money(subtotal * COMMISSION_RATE)
    payout_total = money(subtotal - commission_amount)

    from apps.geo.services import get_cart_food_miles

    food_miles = get_cart_food_miles(
        user,
        postcode=payload["customer_postcode"],
        selected_cart_item_ids=payload.get("selected_cart_item_ids"),
    )
    # distance snapshot lets order history show what address was actually used
    max_distance = max(
        (Decimal(str(row["distance_miles"])) for row in food_miles.get("producer_totals", [])),
        default=Decimal("0.00"),
    )
    return Order.objects.create(
        customer=user,
        delivery_address=payload["delivery_address"],
        delivery_address_label=(payload.get("delivery_address_label") or "").strip(),
        selected_address_id=payload.get("selected_address_id"),
        customer_postcode=payload["customer_postcode"],
        total_food_miles=money(Decimal(str(food_miles.get("total_food_miles") or "0.00"))),
        max_food_miles=money(max_distance),
        within_twenty_miles=max_distance <= Decimal("20.00"),
        subtotal_amount=subtotal,
        commission_rate=COMMISSION_RATE,
        commission_amount=commission_amount,
        total_amount=subtotal,
        producer_payout_total=payout_total,
        payment_method=payment_method,
        payment_terms=(payload.get("payment_terms") or "pay_online_now").strip(),
        purchase_order_number=(payload.get("purchase_order_number") or "").strip(),
        payment_reference=payment_reference,
        payment_status=payment_status,
        status=Order.Status.PENDING,
        special_instructions=special_instructions,
    )


def _create_order_structure(
    order: Order, groups: list[CartProducerGroup], delivery_dates: dict[int, date], special_instructions: str
) -> None:
    # sub orders keep each producer fulfilment workflow separate under one order
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
            # order items copy product facts so receipts survive later product edits
            unit_price = cart_item_unit_price(item)
            line_total = cart_item_line_total(item)
            is_surplus = product_has_active_surplus_deal(item.product)
            OrderItem.objects.create(
                order=order,
                sub_order=sub_order,
                product=item.product,
                product_name=item.product.name,
                producer_name=group.producer.business_name,
                product_image_url=item.product.image_url or default_marketplace_image_url(item.product.id),
                allergen_info=item.product.allergen_info,
                is_organic=item.product.is_organic,
                organic_certification=item.product.organic_certification,
                is_surplus=is_surplus,
                surplus_discount_percent=item.product.surplus_discount_percent if is_surplus else None,
                surplus_original_unit_price=item.product.price if is_surplus else None,
                surplus_best_before=item.product.surplus_best_before if is_surplus else "",
                surplus_note=item.product.surplus_note if is_surplus else "",
                unit=item.product.unit,
                quantity=item.quantity,
                unit_price=unit_price,
                line_total=line_total,
            )


def _producer_portal_stock_units(quantity: Decimal) -> int:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_producer_portal_stock_units` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # marketplace stock can be decimal while producer portal stock is whole units
    whole_units = quantity.to_integral_value()
    if quantity == whole_units:
        return int(whole_units)
    return int(quantity.to_integral_value(rounding=ROUND_CEILING))


def _matching_producer_portal_product(order_item: OrderItem):
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_matching_producer_portal_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # producer portal has a separate product model so stock sync needs a matching rule
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_adjust_order_product_stock` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    if order_item.product is None:
        return

    # orders product stock is the buyer facing stock source
    next_stock = money(order_item.product.stock_quantity + quantity_delta)
    if next_stock < Decimal("0.00"):
        raise ValueError(f"Product '{order_item.product_name}' no longer has enough stock.")

    order_item.product.stock_quantity = next_stock
    order_item.product.is_available = next_stock > Decimal("0.00")
    order_item.product.save(update_fields=["stock_quantity", "is_available", "updated_at"])
    sync_catalog_product_from_orders_product(order_item.product)


def _adjust_producer_portal_stock(order_item: OrderItem, quantity_delta: Decimal) -> None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_adjust_producer_portal_stock` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # producer stock sync is best effort because older demo rows may not have mirrors
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
    try:
        from apps.producer_portal.views import _record_inventory_event, _sync_product_notifications

        _record_inventory_event(
            producer_product,
            actor=None,
            event_type="stock_reserved" if quantity_delta < Decimal("0.00") else "stock_released",
        )
        _sync_product_notifications(producer_product)
    except Exception:
        pass


def reserve_stock_for_order(order: Order) -> None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `reserve_stock_for_order` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # stripe checkout reserves stock before redirecting away from the site
    for order_item in order.items.select_related("product__producer__user").all():
        _adjust_order_product_stock(order_item, -order_item.quantity)
        _adjust_producer_portal_stock(order_item, -order_item.quantity)


def release_stock_reservation_for_order(order: Order) -> None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `release_stock_reservation_for_order` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # failed payments release the same quantities that were reserved
    for order_item in order.items.select_related("product__producer__user").all():
        _adjust_order_product_stock(order_item, order_item.quantity)
        _adjust_producer_portal_stock(order_item, order_item.quantity)


def clear_checked_out_cart_items(order: Order, selected_cart_item_ids: list[int] | None) -> None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `clear_checked_out_cart_items` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # none means full cart checkout and a list means selected item checkout
    cart = Cart.objects.filter(customer=order.customer).first()
    if cart is None:
        return
    if selected_cart_item_ids is None:
        cart.items.all().delete()
    else:
        cart.items.filter(id__in=selected_cart_item_ids).delete()


def create_order_notifications(order: Order) -> None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `create_order_notifications` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # notifications are created only after successful payment confirmation
    special_instructions = order.special_instructions.strip()
    for sub_order in order.sub_orders.select_related("producer").all():
        ProducerNotification.objects.get_or_create(
            producer=sub_order.producer,
            sub_order=sub_order,
            category="order",
            defaults={
                "message": (
                    f"New order {order.order_number} for {sub_order.producer.business_name} "
                    f"(delivery {sub_order.delivery_date}, lead time {sub_order.producer.lead_time_hours}h)"
                ),
                "metadata": {"order_id": order.id, "sub_order_id": sub_order.id},
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `checkout_cart_with_stripe_reservation` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # stripe orders enter as pending reservations with stock held
    # cart cleanup and notifications wait for webhook or success confirmation
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `checkout_cart` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # the non stripe test card path is used by older flows and tests
    # it completes immediately so stock notification and cart cleanup happen here
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
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `reorder_order_to_cart` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # reorder is intentionally conservative with unavailable items
    # blocked rows are reported back instead of silently added to cart
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
        if not product.is_orderable() or product.stock_quantity <= Decimal("0.00"):
            reason = "Product out of season." if product.is_available and product.stock_quantity > Decimal("0.00") else "Product unavailable."
            unavailable.append({"product_name": product.name, "reason": reason})
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
