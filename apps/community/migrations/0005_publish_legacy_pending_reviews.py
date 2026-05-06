from django.db import migrations, models


def publish_legacy_pending_reviews(apps, schema_editor):
    ProductReview = apps.get_model("community", "ProductReview")
    ProductReview.objects.filter(moderation_status="pending").update(
        moderation_status="published",
        moderation_reason="",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("community", "0004_productreview_title_and_anonymous"),
    ]

    operations = [
        migrations.RunPython(publish_legacy_pending_reviews, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="productreview",
            name="community_unique_review_per_user_product",
        ),
        migrations.AddConstraint(
            model_name="productreview",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    user__isnull=False,
                    moderation_status__in=["published", "pending"],
                ),
                fields=("user", "product"),
                name="community_unique_review_per_user_product",
            ),
        ),
    ]
