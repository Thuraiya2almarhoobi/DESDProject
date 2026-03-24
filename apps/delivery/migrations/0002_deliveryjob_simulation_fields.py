from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("delivery", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="deliveryjob",
            name="simulation_duration_seconds",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="deliveryjob",
            name="simulation_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
