from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ModerationAction, ModerationReport
from .services import TARGET_MODEL_MAP, moderation_context_for_report, moderation_context_for_user

User = get_user_model()


class ModerationReportCreateSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=ModerationReport.TargetType.choices)
    object_id = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        if attrs["target_type"] not in TARGET_MODEL_MAP:
            raise serializers.ValidationError({"target_type": "Unsupported report target."})
        return attrs


class ModerationReportSerializer(serializers.ModelSerializer):
    reported_by_email = serializers.EmailField(source="reported_by.email", read_only=True)
    reported_by_role = serializers.CharField(source="reported_by.role", read_only=True)
    resolved_by_email = serializers.EmailField(source="resolved_by.email", read_only=True)
    target_label = serializers.SerializerMethodField()
    target_exists = serializers.SerializerMethodField()
    target_context = serializers.SerializerMethodField()

    class Meta:
        model = ModerationReport
        fields = [
            "id",
            "target_type",
            "object_id",
            "target_label",
            "target_exists",
            "reported_by",
            "reported_by_email",
            "reported_by_role",
            "reason",
            "status",
            "target_snapshot",
            "target_context",
            "resolved_by",
            "resolved_by_email",
            "resolution_note",
            "removed_at",
            "kept_at",
            "created_at",
            "updated_at",
        ]

    def get_target_exists(self, obj: ModerationReport) -> bool:
        return obj.target is not None

    def get_target_label(self, obj: ModerationReport) -> str:
        snapshot = obj.target_snapshot or {}
        return (
            snapshot.get("title")
            or snapshot.get("name")
            or snapshot.get("email")
            or snapshot.get("display_name")
            or f"{obj.target_type} #{obj.object_id}"
        )

    def get_target_context(self, obj: ModerationReport) -> dict:
        return moderation_context_for_report(obj)


class ModerationResolutionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class ModerationActionSerializer(serializers.ModelSerializer):
    admin_email = serializers.EmailField(source="admin_user.email", read_only=True)

    class Meta:
        model = ModerationAction
        fields = [
            "id",
            "target_type",
            "object_id",
            "action",
            "note",
            "admin_email",
            "before_snapshot",
            "after_snapshot",
            "created_at",
        ]


class ModerationItemActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ModerationAction.Action.choices)
    note = serializers.CharField(max_length=2000, allow_blank=False, trim_whitespace=True)


class ModerationItemSerializer(serializers.Serializer):
    target_type = serializers.CharField()
    object_id = serializers.IntegerField()
    label = serializers.CharField()
    subtitle = serializers.CharField(allow_blank=True)
    visibility = serializers.CharField()
    owner = serializers.DictField()
    snapshot = serializers.DictField()
    public_url = serializers.CharField(allow_blank=True)
    open_report_count = serializers.IntegerField()
    total_report_count = serializers.IntegerField()
    kept_report_count = serializers.IntegerField()
    removed_report_count = serializers.IntegerField()
    keep_action_count = serializers.IntegerField()
    removal_action_count = serializers.IntegerField()
    last_updated = serializers.DateTimeField(allow_null=True, required=False)


class ModerationItemDetailSerializer(ModerationItemSerializer):
    context = serializers.DictField()
    reports = ModerationReportSerializer(many=True)
    actions = ModerationActionSerializer(many=True)


class ModerationUserSerializer(serializers.ModelSerializer):
    moderation_context = serializers.SerializerMethodField()
    open_report_count = serializers.SerializerMethodField()
    total_report_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "is_active",
            "date_joined",
            "open_report_count",
            "total_report_count",
            "moderation_context",
        ]

    def get_moderation_context(self, obj: User) -> dict:
        return moderation_context_for_user(obj)

    def get_open_report_count(self, obj: User) -> int:
        return int(getattr(obj, "open_report_count", 0))

    def get_total_report_count(self, obj: User) -> int:
        return int(getattr(obj, "total_report_count", 0))


class ModerationUserActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["deactivate", "reactivate"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
