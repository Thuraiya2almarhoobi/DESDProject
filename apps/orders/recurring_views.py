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

from .models import Order, RecurringOrderTemplate
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


def _template_payload(template: RecurringOrderTemplate) -> dict:
    payload = RecurringOrderTemplateSerializer(template).data
    payload["alerts"] = build_template_alerts(template)
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


class RestaurantRecurringOrderListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsRestaurant]

    def get(self, request):
        templates = (
            RecurringOrderTemplate.objects.filter(restaurant=request.user)
            .prefetch_related("items__product__producer")
            .order_by("-created_at")
        )
        return Response([_template_payload(template) for template in templates])

    def post(self, request):
        serializer = RecurringOrderTemplateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            template, initial_order = create_recurring_template_from_checkout(
                request.user, serializer.validated_data
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Recurring order template created.",
                "template": _template_payload(template),
                "initial_order": OrderDetailSerializer(initial_order).data,
            },
            status=status.HTTP_201_CREATED,
        )


class RestaurantRecurringOrderDetailAPIView(APIView):
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
        for key, value in serializer.validated_data.items():
            setattr(template, key, value)
        template.save()
        template.refresh_from_db()
        return Response(_template_payload(template))


class RestaurantRecurringOrderNextInstanceAPIView(APIView):
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
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in {User.Role.ADMIN, User.Role.RESTAURANT}:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        if user.role == User.Role.ADMIN:
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
    permission_classes = [IsAuthenticated, IsRestaurant]

    def get(self, request, pk: int):
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
