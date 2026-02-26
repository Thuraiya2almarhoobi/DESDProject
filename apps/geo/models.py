from django.db import models


class PostcodeLocation(models.Model):
    postcode = models.CharField(max_length=12, unique=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["postcode"]

    def __str__(self) -> str:
        return self.postcode
