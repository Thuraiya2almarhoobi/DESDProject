from django.contrib import admin

from .models import PostcodeLocation


@admin.register(PostcodeLocation)
class PostcodeLocationAdmin(admin.ModelAdmin):
    list_display = ("postcode", "latitude", "longitude", "updated_at")
    search_fields = ("postcode",)
