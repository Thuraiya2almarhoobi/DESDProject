from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("producer_portal", "0002_producerproduct_season_end_month_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="producerproduct",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(
                default=10,
                validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(9999)],
            ),
        ),
    ]
