import apps.orders.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0004_product_season_end_month_product_season_start_month"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="order_number",
            field=models.CharField(default=apps.orders.models._generate_order_number, max_length=32, unique=True),
        ),
    ]
