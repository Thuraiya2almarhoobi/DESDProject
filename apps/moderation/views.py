from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import ModerationReport
from .serializers import (
    ModerationReportCreateSerializer,
    ModerationReportSerializer,
    ModerationResolutionSerializer,
    ModerationItemActionSerializer,
    ModerationItemDetailSerializer,
    ModerationItemSerializer,
    ModerationUserActionSerializer,
    ModerationUserSerializer,
)
from .services import (
    apply_moderation_action,
    browse_moderation_items,
    create_report,
    get_user_report,
    keep_reported_target,
    moderation_item_detail,
    remove_reported_target,
)


class IsAdminUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class ModerationReportListCreateAPIView(APIView):
    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]

    def get(self, request):
        queryset = ModerationReport.objects.select_related("reported_by", "resolved_by", "content_type").all()
        report_status = request.query_params.get("status")
        target_type = request.query_params.get("target_type")
        if report_status in {choice for choice, _ in ModerationReport.Status.choices}:
            queryset = queryset.filter(status=report_status)
        if target_type in {choice for choice, _ in ModerationReport.TargetType.choices}:
            queryset = queryset.filter(target_type=target_type)
        search_query = (request.query_params.get("q") or "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(reason__icontains=search_query)
                | Q(reported_by__email__icontains=search_query)
                | Q(reported_by__role__icontains=search_query)
                | Q(target_snapshot__icontains=search_query)
            )
        return Response(ModerationReportSerializer(queryset[:200], many=True).data)

    def post(self, request):
        serializer = ModerationReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            report = create_report(
                target_type=serializer.validated_data["target_type"],
                object_id=serializer.validated_data["object_id"],
                reported_by=request.user,
                reason=serializer.validated_data.get("reason", ""),
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ModerationReportSerializer(report).data, status=status.HTTP_201_CREATED)


class ModerationSummaryAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        by_status = dict(ModerationReport.objects.values_list("status").annotate(count=Count("id")))
        by_type = dict(
            ModerationReport.objects.filter(status=ModerationReport.Status.OPEN)
            .values_list("target_type")
            .annotate(count=Count("id"))
        )
        return Response(
            {
                "open": by_status.get(ModerationReport.Status.OPEN, 0),
                "kept": by_status.get(ModerationReport.Status.KEPT, 0),
                "removed": by_status.get(ModerationReport.Status.REMOVED, 0),
                "open_by_type": by_type,
            }
        )


class ModerationItemListAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        try:
            payload = browse_moderation_items(
                query=request.query_params.get("q", ""),
                target_type=request.query_params.get("type", ""),
                visibility=request.query_params.get("visibility", ""),
                reported=request.query_params.get("reported", ""),
                owner=request.query_params.get("owner", ""),
                page=int(request.query_params.get("page", 1)),
                page_size=int(request.query_params.get("page_size", 24)),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                **payload,
                "results": ModerationItemSerializer(payload["results"], many=True).data,
            }
        )


class ModerationItemDetailAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request, target_type: str, object_id: int):
        try:
            payload = moderation_item_detail(target_type, object_id)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(ModerationItemDetailSerializer(payload).data)


class ModerationItemActionAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request, target_type: str, object_id: int):
        serializer = ModerationItemActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = apply_moderation_action(
                target_type=target_type,
                object_id=object_id,
                action=serializer.validated_data["action"],
                admin_user=request.user,
                note=serializer.validated_data["note"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        detail = moderation_item_detail(target_type, object_id)
        return Response(ModerationItemDetailSerializer(detail).data)


class ModerationUserListAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        user_content_type = ContentType.objects.get_for_model(User, for_concrete_model=False)
        queryset = User.objects.exclude(role=User.Role.ADMIN).order_by("email")
        role = request.query_params.get("role")
        status = request.query_params.get("account_status")
        search_query = (request.query_params.get("q") or "").strip()
        if role in {choice for choice, _ in User.Role.choices}:
            queryset = queryset.filter(role=role)
        if status == "active":
            queryset = queryset.filter(is_active=True)
        elif status == "inactive":
            queryset = queryset.filter(is_active=False)
        if search_query:
            queryset = queryset.filter(Q(email__icontains=search_query) | Q(role__icontains=search_query))

        users = list(queryset[:100])
        open_report_counts = dict(
            ModerationReport.objects.filter(
                content_type=user_content_type,
                object_id__in=[user.id for user in users],
                status=ModerationReport.Status.OPEN,
            )
            .values_list("object_id")
            .annotate(count=Count("id"))
        )
        total_report_counts = dict(
            ModerationReport.objects.filter(
                content_type=user_content_type,
                object_id__in=[user.id for user in users],
            )
            .values_list("object_id")
            .annotate(count=Count("id"))
        )
        for user in users:
            user.open_report_count = open_report_counts.get(user.id, 0)
            user.total_report_count = total_report_counts.get(user.id, 0)
        return Response(ModerationUserSerializer(users, many=True).data)


class ModerationUserActionAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request, user_id: int):
        target_user = get_object_or_404(User.objects.exclude(role=User.Role.ADMIN), id=user_id)
        serializer = ModerationUserActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        target_user.is_active = action != "deactivate"
        target_user.save(update_fields=["is_active"])
        return Response(ModerationUserSerializer(target_user).data)


class MyModerationReportStatusAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = ModerationReportCreateSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            report = get_user_report(
                target_type=serializer.validated_data["target_type"],
                object_id=serializer.validated_data["object_id"],
                reported_by=request.user,
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "reported": report is not None,
                "report_id": report.id if report else None,
                "status": report.status if report else None,
            }
        )


class ModerationReportRemoveAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request, report_id: int):
        report = get_object_or_404(ModerationReport.objects.select_related("content_type"), id=report_id)
        serializer = ModerationResolutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            report = remove_reported_target(report, admin_user=request.user, note=serializer.validated_data.get("note", ""))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ModerationReportSerializer(report).data)


class ModerationReportKeepAPIView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request, report_id: int):
        report = get_object_or_404(ModerationReport.objects.select_related("content_type"), id=report_id)
        serializer = ModerationResolutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            report = keep_reported_target(report, admin_user=request.user, note=serializer.validated_data.get("note", ""))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ModerationReportSerializer(report).data)
