from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("orders", "0005_alter_order_order_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="producersuborder",
            name="settlement_processed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="producernotification",
            name="category",
            field=models.CharField(default="order", max_length=50),
        ),
        migrations.AddField(
            model_name="producernotification",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="producernotification",
            name="resolved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="producernotification",
            name="sub_order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="notifications",
                to="orders.producersuborder",
            ),
        ),
        migrations.CreateModel(
            name="ProductAllergenAcknowledgement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("acknowledged_at", models.DateTimeField(auto_now_add=True)),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="allergen_acknowledgements",
                        to="orders.product",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="product_allergen_acknowledgements",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-acknowledged_at"]},
        ),
        migrations.CreateModel(
            name="ProducerSubOrderStatusHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "previous_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("confirmed", "Confirmed"),
                            ("ready", "Ready"),
                            ("delivered", "Delivered"),
                            ("cancelled", "Cancelled"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "new_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("confirmed", "Confirmed"),
                            ("ready", "Ready"),
                            ("delivered", "Delivered"),
                            ("cancelled", "Cancelled"),
                        ],
                        max_length=20,
                    ),
                ),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="producer_sub_order_status_changes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "sub_order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="status_history",
                        to="orders.producersuborder",
                    ),
                ),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.AddConstraint(
            model_name="productallergenacknowledgement",
            constraint=models.UniqueConstraint(
                fields=("user", "product"),
                name="orders_unique_user_product_allergen_ack",
            ),
        ),
    ]
