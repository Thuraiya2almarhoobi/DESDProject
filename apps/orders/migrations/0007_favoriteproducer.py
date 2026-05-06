from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("orders", "0006_allergen_ack_status_history_notifications"),
    ]

    operations = [
        migrations.CreateModel(
            name="FavoriteProducer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "producer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="favorited_by",
                        to="orders.producer",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="favorite_producers",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="favoriteproducer",
            constraint=models.UniqueConstraint(
                fields=("user", "producer"),
                name="orders_unique_user_favorite_producer",
            ),
        ),
        migrations.AddIndex(
            model_name="favoriteproducer",
            index=models.Index(fields=["producer", "created_at"], name="orders_favprod_producer_idx"),
        ),
        migrations.AddIndex(
            model_name="favoriteproducer",
            index=models.Index(fields=["user", "created_at"], name="orders_favprod_user_idx"),
        ),
    ]
