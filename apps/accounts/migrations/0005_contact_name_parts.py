from django.db import migrations, models


def split_contact_name(full_name):
    tokens = [token for token in (full_name or "").strip().split() if token]
    if not tokens:
        return "", "", ""
    if len(tokens) == 1:
        return tokens[0], "", ""
    if len(tokens) == 2:
        return tokens[0], "", tokens[1]
    return tokens[0], " ".join(tokens[1:-1]), tokens[-1]


def split_existing_contact_names(apps, schema_editor):
    for model_name in ("ProducerProfile", "CommunityGroupProfile", "RestaurantProfile"):
        profile_model = apps.get_model("accounts", model_name)
        for profile in profile_model.objects.all().iterator():
            first_name, middle_name, last_name = split_contact_name(getattr(profile, "contact_name", ""))
            profile.contact_first_name = first_name
            profile.contact_middle_name = middle_name
            profile.contact_last_name = last_name
            profile.save(update_fields=["contact_first_name", "contact_middle_name", "contact_last_name"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_customerprofile_name_parts"),
    ]

    operations = [
        migrations.AddField(
            model_name="producerprofile",
            name="contact_first_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="producerprofile",
            name="contact_last_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="producerprofile",
            name="contact_middle_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="communitygroupprofile",
            name="contact_first_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="communitygroupprofile",
            name="contact_last_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="communitygroupprofile",
            name="contact_middle_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="restaurantprofile",
            name="contact_first_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="restaurantprofile",
            name="contact_last_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="restaurantprofile",
            name="contact_middle_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.RunPython(split_existing_contact_names, migrations.RunPython.noop),
    ]
