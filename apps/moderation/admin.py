from django.contrib import admin

from .models import ModerationAction, ModerationReport


@admin.register(ModerationReport)
class ModerationReportAdmin(admin.ModelAdmin):
    list_display = ("target_type", "object_id", "reported_by", "status", "resolved_by", "created_at")
    list_filter = ("target_type", "status", "created_at")
    search_fields = ("reason", "resolution_note", "target_snapshot")
    readonly_fields = ("created_at", "updated_at", "removed_at", "kept_at")


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = ("target_type", "object_id", "action", "admin_user", "created_at")
    list_filter = ("target_type", "action", "created_at")
    search_fields = ("note", "before_snapshot", "after_snapshot", "admin_user__email")
    readonly_fields = ("created_at",)
