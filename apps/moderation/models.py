from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class ModerationReport(models.Model):
    class TargetType(models.TextChoices):
        CUSTOMER_ACCOUNT = "customer_account", "Customer account"
        PRODUCER_ACCOUNT = "producer_account", "Producer account"
        PRODUCT = "product", "Product"
        REVIEW = "review", "Review"
        RECIPE = "recipe", "Recipe"
        FARM_STORY = "farm_story", "Farm story"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        KEPT = "kept", "Kept"
        REMOVED = "removed", "Removed"

    target_type = models.CharField(max_length=40, choices=TargetType.choices)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_reports_submitted",
    )
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    removed_at = models.DateTimeField(null=True, blank=True)
    kept_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_reports_resolved",
    )
    resolution_note = models.TextField(blank=True)
    target_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_type", "status"]),
            models.Index(fields=["content_type", "object_id", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["content_type", "object_id", "reported_by", "status"],
                condition=models.Q(status="open"),
                name="unique_open_report_per_user_target",
            )
        ]

    def __str__(self) -> str:
        return f"{self.target_type}:{self.object_id} ({self.status})"


class ModerationAction(models.Model):
    class Action(models.TextChoices):
        REMOVE = "remove", "Remove"
        RESTORE = "restore", "Restore"
        DEACTIVATE = "deactivate", "Deactivate"
        REACTIVATE = "reactivate", "Reactivate"
        KEEP_LIVE = "keep_live", "Keep live"

    target_type = models.CharField(max_length=40, choices=ModerationReport.TargetType.choices)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")
    action = models.CharField(max_length=24, choices=Action.choices)
    note = models.TextField()
    admin_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_actions_taken",
    )
    before_snapshot = models.JSONField(default=dict, blank=True)
    after_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_type", "object_id", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.target_type}:{self.object_id}"
