from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0002_generatedcontentsuggestion"),
    ]

    operations = [
        migrations.AddField(
            model_name="recipe",
            name="is_ai_generated",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="farmstory",
            name="is_ai_generated",
            field=models.BooleanField(default=False),
        ),
    ]
