from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("producer_portal", "0007_producerproduct_no_known_allergens_confirmed"),
    ]

    operations = [
        migrations.AddField(
            model_name="producerproductinventoryevent",
            name="changed_fields",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="producerproductinventoryevent",
            name="previous_values",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="producerproductinventoryevent",
            name="new_values",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
