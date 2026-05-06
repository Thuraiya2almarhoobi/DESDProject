from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("producer_portal", "0003_producerproduct_low_stock_threshold"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProducerProductInventoryEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(max_length=40)),
                ("previous_stock_quantity", models.PositiveIntegerField(blank=True, null=True)),
                ("new_stock_quantity", models.PositiveIntegerField(blank=True, null=True)),
                ("previous_availability", models.CharField(blank=True, max_length=20)),
                ("new_availability", models.CharField(blank=True, max_length=20)),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="producer_inventory_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="inventory_events",
                        to="producer_portal.producerproduct",
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
