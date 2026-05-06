from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("producer_portal", "0004_inventory_events"),
    ]

    operations = [
        migrations.AddField(
            model_name="producerproduct",
            name="storage_tips",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="producerproduct",
            name="storage_tips_ai_generated",
            field=models.BooleanField(default=False),
        ),
    ]
