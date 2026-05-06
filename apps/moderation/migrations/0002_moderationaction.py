from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("moderation", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ModerationAction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "target_type",
                    models.CharField(
                        choices=[
                            ("customer_account", "Customer account"),
                            ("producer_account", "Producer account"),
                            ("product", "Product"),
                            ("review", "Review"),
                            ("recipe", "Recipe"),
                            ("farm_story", "Farm story"),
                        ],
                        max_length=40,
                    ),
                ),
                ("object_id", models.PositiveIntegerField()),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("remove", "Remove"),
                            ("restore", "Restore"),
                            ("deactivate", "Deactivate"),
                            ("reactivate", "Reactivate"),
                            ("keep_live", "Keep live"),
                        ],
                        max_length=24,
                    ),
                ),
                ("note", models.TextField()),
                ("before_snapshot", models.JSONField(blank=True, default=dict)),
                ("after_snapshot", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "admin_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="moderation_actions_taken",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "content_type",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="contenttypes.contenttype"),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["target_type", "object_id", "created_at"], name="moderation__target__b5364f_idx"),
                    models.Index(fields=["action", "created_at"], name="moderation__action_02c583_idx"),
                ],
            },
        ),
    ]
