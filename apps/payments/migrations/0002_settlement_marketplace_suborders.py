from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0006_allergen_ack_status_history_notifications"),
        ("payments", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="settlementorderline",
            name="order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="settlement_lines",
                to="producer_portal.producerorder",
            ),
        ),
        migrations.AddField(
            model_name="settlementorderline",
            name="sub_order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="settlement_lines",
                to="orders.producersuborder",
            ),
        ),
        migrations.AddConstraint(
            model_name="settlementorderline",
            constraint=models.UniqueConstraint(
                fields=("settlement", "sub_order"),
                name="unique_sub_order_per_settlement",
            ),
        ),
    ]
