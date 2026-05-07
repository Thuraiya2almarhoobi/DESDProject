"""
DESD Marketplace documentation.

File role:
    Exposes recurring-order HTTP endpoints and converts scheduling service results into API responses.

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

from dataclasses import asdict

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsRestaurant

from .models import Order, Producer, RecurringOrderTemplate
from .recurring_services import (
    advance_template_schedule,
    build_template_alerts,
    create_recurring_template_from_checkout,
    generate_due_recurring_orders,
    generate_order_for_template,
    set_next_instance_override,
)
from .serializers import (
    OrderDetailSerializer,
    RecurringOrderInstanceOverrideSerializer,
    RecurringOrderNextInstancePatchSerializer,
    RecurringOrderTemplateCreateSerializer,
    RecurringOrderTemplateSerializer,
    RecurringOrderTemplateUpdateSerializer,
)

# restaurant recurring order api views and template lifecycle endpoints
# services own generation rules so views stay permission and response focused


def _template_payload(template: RecurringOrderTemplate) -> dict:
    """
    Helper for the file role: Exposes recurring-order HTTP endpoints and converts scheduling service results into API responses.

    `_template_payload` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    payload = RecurringOrderTemplateSerializer(template).data
    payload["alerts"] = build_template_alerts(template)
    # next instance override is returned beside the template for clear ui separation
    # the default template remains readable even when a next run is edited
    next_override = (
        template.instance_overrides.filter(
            scheduled_order_date=template.next_order_date
        )
        .prefetch_related("items__product")
        .first()
    )
    payload["next_instance_override"] = (
        RecurringOrderInstanceOverrideSerializer(next_override).data if next_override else None
    )
    payload["next_run_date"] = str(template.next_order_date)
    return payload


def _restaurant_name(user) -> str:
    profile = getattr(user, "restaurant_profile", None)
    if profile and profile.business_name:
        return profile.business_name
    local = (user.email or "restaurant").split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
    return " ".join(part.capitalize() for part in local.split() if part) or "Restaurant"


class ProducerRecurringDemandAPIView(APIView):
    """Show producers upcoming restaurant recurring templates that include their products."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        producer = get_object_or_404(Producer, user=request.user, is_active=True)
        # producers see recurring demand before it becomes normal sales orders
        # this is advance notice for harvest prep stock planning and staffing
        templates = (
            RecurringOrderTemplate.objects.filter(
                items__product__producer=producer,
                is_cancelled=False,
            )
            .select_related("restaurant")
            .prefetch_related("items__product__producer", "instance_overrides__items__product")
            .distinct()
            .order_by("next_order_date", "id")
        )

        payload = []
        for template in templates:
            next_override = (
                template.instance_overrides.filter(scheduled_order_date=template.next_order_date)
                .prefetch_related("items__product")
                .first()
            )
            override_quantities = {
                item.product_id: item.quantity for item in next_override.items.all()
            } if next_override else {}
            # producer demand only includes products owned by the signed in producer
            # restaurant templates may contain products from several suppliers
            producer_items = [
                item for item in template.items.all() if item.product.producer_id == producer.id
            ]
            item_rows = []
            subtotal = 0
            unavailable = []
            for item in producer_items:
                quantity = override_quantities.get(item.product_id, item.default_quantity)
                unit_price = item.product.price
                line_total = unit_price * quantity
                subtotal += line_total
                is_available = item.product.is_orderable() and item.product.stock_quantity >= quantity
                if not is_available:
                    # unavailable items stay visible so producers can understand the risk
                    # restaurants also see similar alerts on their template page
                    unavailable.append(item.product.name)
                item_rows.append(
                    {
                        "product_id": item.product_id,
                        "product_name": item.product.name,
                        "quantity": quantity,
                        "default_quantity": item.default_quantity,
                        "unit": item.product.unit,
                        "unit_price": unit_price,
                        "line_total": line_total,
                        "available_stock": item.product.stock_quantity,
                        "is_available": is_available,
                    }
                )

            payload.append(
                {
                    "id": template.id,
                    "restaurant_name": _restaurant_name(template.restaurant),
                    "restaurant_email": template.restaurant.email,
                    "frequency": template.frequency,
                    "order_day": template.order_day,
                    "delivery_day": template.delivery_day,
                    "next_order_date": template.next_order_date,
                    "delivery_address": template.delivery_address,
                    "customer_postcode": template.customer_postcode,
                    "payment_method": template.payment_method,
                    "is_paused": template.is_paused,
                    "last_generated_at": template.last_generated_at,
                    "next_instance_override": RecurringOrderInstanceOverrideSerializer(next_override).data if next_override else None,
                    "producer_subtotal": subtotal,
                    "unavailable_products": unavailable,
                    "items": item_rows,
                }
            )
        return Response(payload)


class RestaurantRecurringOrderListCreateAPIView(APIView):
    """List a restaurant's recurring templates or create a new one from checkout."""

    permission_classes = [IsAuthenticated, IsRestaurant]

    def get(self, request):
        # restaurants only list their own templates so ownership is enforced server side
        templates = (
            RecurringOrderTemplate.objects.filter(restaurant=request.user)
            .prefetch_related("items__product__producer")
            .order_by("-created_at")
        )
        return Response([_template_payload(template) for template in templates])

    def post(self, request):
        serializer = RecurringOrderTemplateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        use_stripe_checkout = serializer.validated_data.get("payment_method") == "stripe_checkout"
        template = None
        initial_order = None
        try:
            # creating a template also creates the first order instance from checkout
            # stripe mode reserves stock and prepares payment for that initial order
            template, initial_order = create_recurring_template_from_checkout(
                request.user,
                serializer.validated_data,
                reserve_payment=use_stripe_checkout,
            )
            if use_stripe_checkout:
                from apps.payments.services import create_stripe_checkout_session_for_order

                checkout_session = create_stripe_checkout_session_for_order(
                    initial_order,
                    success_url=serializer.validated_data.get("success_url"),
                    cancel_url=serializer.validated_data.get("cancel_url"),
                )
        except ValueError as exc:
            if use_stripe_checkout and template is not None and initial_order is not None:
                try:
                    # failed stripe setup cancels the first order and removes the new template
                    # this avoids orphan recurring templates after payment setup errors
                    from apps.payments.services import cancel_stripe_checkout_order

                    cancel_stripe_checkout_order(initial_order)
                except ValueError:
                    pass
                template.delete()
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        response_payload = {
            "message": "Recurring order template created."
            if not use_stripe_checkout
            else "Recurring order template created and Stripe checkout session prepared.",
            "template": _template_payload(template),
            "initial_order": OrderDetailSerializer(initial_order).data,
        }
        if use_stripe_checkout:
            response_payload["payment"] = {
                "provider": "stripe",
                "checkout_session_id": checkout_session.session_id,
                "checkout_url": checkout_session.checkout_url,
                "publishable_key": checkout_session.publishable_key,
                "test_mode": checkout_session.test_mode,
            }

        return Response(response_payload, status=status.HTTP_201_CREATED)


class RestaurantRecurringOrderDetailAPIView(APIView):
    """Read or partially update one recurring-order template."""

    permission_classes = [IsAuthenticated, IsRestaurant]

    def get(self, request, pk: int):
        template = get_object_or_404(
            RecurringOrderTemplate.objects.prefetch_related("items__product__producer"),
            pk=pk,
            restaurant=request.user,
        )
        return Response(_template_payload(template))

    def patch(self, request, pk: int):
        template = get_object_or_404(RecurringOrderTemplate, pk=pk, restaurant=request.user)
        serializer = RecurringOrderTemplateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        # patching the template changes future defaults not the next instance override
        # the restaurant ui has a separate endpoint for one off next run edits
        for key, value in serializer.validated_data.items():
            setattr(template, key, value)
        template.save()
        template.refresh_from_db()
        return Response(_template_payload(template))


class RestaurantRecurringOrderNextInstanceAPIView(APIView):
    """Edit the next generated instance for a recurring template before it runs."""

    permission_classes = [IsAuthenticated, IsRestaurant]

    def patch(self, request, pk: int):
        template = get_object_or_404(
            RecurringOrderTemplate.objects.prefetch_related("items"),
            pk=pk,
            restaurant=request.user,
        )
        serializer = RecurringOrderNextInstancePatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            # next instance edits are saved separately so the standing template stays stable
            # this supports one off restaurant adjustments without losing the base order
            override = set_next_instance_override(
                template,
                serializer.validated_data["items"],
                created_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Next recurring instance updated.",
                "override": RecurringOrderInstanceOverrideSerializer(override).data,
                "template": _template_payload(template),
            }
        )


class RestaurantRecurringOrderRunAPIView(APIView):
    """Generate due recurring orders for one restaurant or all restaurants as admin."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in {User.Role.ADMIN, User.Role.RESTAURANT}:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        if user.role == User.Role.ADMIN:
            # admin run simulates the scheduled automation across all due templates
            # restaurant run limits generation to that restaurant only
            results = generate_due_recurring_orders()
        else:
            today = timezone.localdate()
            templates = (
                RecurringOrderTemplate.objects.filter(
                    restaurant=user,
                    is_paused=False,
                    is_cancelled=False,
                    next_order_date__lte=today,
                )
                .select_related("restaurant")
                .prefetch_related("items__product__producer")
                .order_by("id")
            )
            results = []
            for template in templates:
                # manual run uses the same service path as automated generation
                # this keeps demo buttons and scheduled jobs consistent
                scheduled_order_date = template.next_order_date
                result = generate_order_for_template(template, scheduled_order_date)
                results.append(result)
                advance_template_schedule(template, scheduled_order_date)

        payload = [asdict(result) for result in results]
        generated_count = len([row for row in payload if row.get("order_id")])
        return Response(
            {
                "run_date": str(timezone.localdate()),
                "generated_count": generated_count,
                "results": payload,
            }
        )


class RestaurantRecurringOrderGeneratedListAPIView(APIView):
    """List orders already generated from a recurring template."""

    permission_classes = [IsAuthenticated, IsRestaurant]

    def get(self, request, pk: int):
        # generated order history lets restaurants prove payment happens per instance
        # it also provides click through data for audits and demos
        template = get_object_or_404(
            RecurringOrderTemplate,
            pk=pk,
            restaurant=request.user,
        )
        orders = (
            Order.objects.filter(recurring_template=template, is_recurring_instance=True)
            .prefetch_related("sub_orders__producer")
            .order_by("-created_at")
        )
        return Response(OrderDetailSerializer(orders, many=True).data)
