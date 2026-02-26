from django.contrib import admin

from .models import FarmStory, Recipe, RecipeProduct, SavedRecipe


class RecipeProductInline(admin.TabularInline):
    model = RecipeProduct
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ("title", "producer", "seasonal_tag", "is_published", "created_at")
    list_filter = ("is_published", "seasonal_tag", "producer")
    search_fields = ("title", "producer__business_name")
    inlines = [RecipeProductInline]


@admin.register(FarmStory)
class FarmStoryAdmin(admin.ModelAdmin):
    list_display = ("title", "producer", "seasonal_tag", "is_published", "created_at")
    list_filter = ("is_published", "seasonal_tag", "producer")
    search_fields = ("title", "producer__business_name", "body")


@admin.register(SavedRecipe)
class SavedRecipeAdmin(admin.ModelAdmin):
    list_display = ("user", "recipe", "created_at")
    search_fields = ("user__username", "recipe__title")
