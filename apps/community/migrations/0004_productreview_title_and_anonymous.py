from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("community", "0003_productreview_moderation_and_response"),
    ]

    operations = [
        migrations.AddField(
            model_name="productreview",
            name="is_anonymous",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="productreview",
            name="title",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
