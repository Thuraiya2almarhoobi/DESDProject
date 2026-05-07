from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0008_order_delivery_address_label_order_max_food_miles_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_terms",
            field=models.CharField(default="pay_online_now", max_length=80),
        ),
        migrations.AddField(
            model_name="order",
            name="purchase_order_number",
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
