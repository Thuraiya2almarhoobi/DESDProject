from django.db import migrations, models


def forward_convert_allergens(apps, schema_editor):
    ProducerProduct = apps.get_model("producer_portal", "ProducerProduct")
    for product in ProducerProduct.objects.all():
        raw_value = product.legacy_allergen_information
        if isinstance(raw_value, list):
            normalized = [item for item in raw_value if isinstance(item, str) and item]
        else:
            normalized = [item.strip() for item in str(raw_value or "").split(",") if item.strip()]
        product.allergen_information = normalized
        product.save(update_fields=["allergen_information"])


def reverse_convert_allergens(apps, schema_editor):
    ProducerProduct = apps.get_model("producer_portal", "ProducerProduct")
    for product in ProducerProduct.objects.all():
        raw_value = product.allergen_information
        if isinstance(raw_value, list):
            product.legacy_allergen_information = ", ".join(item for item in raw_value if isinstance(item, str) and item)
            product.save(update_fields=["legacy_allergen_information"])


class Migration(migrations.Migration):

    dependencies = [
        ("producer_portal", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="producerproduct",
            old_name="allergen_information",
            new_name="legacy_allergen_information",
        ),
        migrations.AddField(
            model_name="producerproduct",
            name="allergen_information",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(forward_convert_allergens, reverse_convert_allergens),
        migrations.RemoveField(
            model_name="producerproduct",
            name="legacy_allergen_information",
        ),
    ]
