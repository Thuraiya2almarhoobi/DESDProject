from django.urls import path

from .views import (
    ModerationItemActionAPIView,
    ModerationItemDetailAPIView,
    ModerationItemListAPIView,
    ModerationReportKeepAPIView,
    ModerationReportListCreateAPIView,
    ModerationReportRemoveAPIView,
    ModerationSummaryAPIView,
    ModerationUserActionAPIView,
    ModerationUserListAPIView,
    MyModerationReportStatusAPIView,
)

urlpatterns = [
    path("reports/", ModerationReportListCreateAPIView.as_view(), name="moderation-reports"),
    path("reports/my-status/", MyModerationReportStatusAPIView.as_view(), name="moderation-my-report-status"),
    path("summary/", ModerationSummaryAPIView.as_view(), name="moderation-summary"),
    path("items/", ModerationItemListAPIView.as_view(), name="moderation-items"),
    path("items/<str:target_type>/<int:object_id>/", ModerationItemDetailAPIView.as_view(), name="moderation-item-detail"),
    path("items/<str:target_type>/<int:object_id>/action/", ModerationItemActionAPIView.as_view(), name="moderation-item-action"),
    path("users/", ModerationUserListAPIView.as_view(), name="moderation-users"),
    path("users/<int:user_id>/action/", ModerationUserActionAPIView.as_view(), name="moderation-user-action"),
    path("reports/<int:report_id>/remove/", ModerationReportRemoveAPIView.as_view(), name="moderation-remove"),
    path("reports/<int:report_id>/keep/", ModerationReportKeepAPIView.as_view(), name="moderation-keep"),
]
