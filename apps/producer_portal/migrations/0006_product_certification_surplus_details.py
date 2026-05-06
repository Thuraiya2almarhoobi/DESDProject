from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("producer_portal", "0005_product_storage_guidance"),
    ]

    operations = [
        migrations.AddField(
            model_name="producerproduct",
            name="is_organic",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="producerproduct",
            name="organic_certification",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="producerproduct",
            name="surplus_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="producerproduct",
            name="surplus_best_before",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="producerproduct",
            name="surplus_note",
            field=models.TextField(blank=True),
        ),
    ]
