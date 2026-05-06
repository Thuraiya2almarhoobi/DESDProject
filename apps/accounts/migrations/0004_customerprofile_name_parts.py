from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_user_email_verification_sent_at_user_email_verified_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="customerprofile",
            name="first_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="customerprofile",
            name="last_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="customerprofile",
            name="middle_name",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
