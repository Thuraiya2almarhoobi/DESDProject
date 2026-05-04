"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin

from .models import FarmStory, Recipe, RecipeProduct, SavedRecipe


class RecipeProductInline(admin.TabularInline):
    """
    Documents the `RecipeProductInline` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    model = RecipeProduct
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    """
    Documents the `RecipeAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("title", "producer", "seasonal_tag", "is_published", "created_at")
    list_filter = ("is_published", "seasonal_tag", "producer")
    search_fields = ("title", "producer__business_name")
    inlines = [RecipeProductInline]


@admin.register(FarmStory)
class FarmStoryAdmin(admin.ModelAdmin):
    """
    Documents the `FarmStoryAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("title", "producer", "seasonal_tag", "is_published", "created_at")
    list_filter = ("is_published", "seasonal_tag", "producer")
    search_fields = ("title", "producer__business_name", "body")


@admin.register(SavedRecipe)
class SavedRecipeAdmin(admin.ModelAdmin):
    """
    Documents the `SavedRecipeAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("user", "recipe", "created_at")
    search_fields = ("user__email", "recipe__title")
