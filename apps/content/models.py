from django.conf import settings
from django.db import models


class Recipe(models.Model):
    producer = models.ForeignKey(
        "orders.Producer", on_delete=models.CASCADE, related_name="recipes"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    ingredients = models.TextField()
    instructions = models.TextField()
    seasonal_tag = models.CharField(max_length=50, blank=True)
    image_url = models.URLField(blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class RecipeProduct(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="recipe_products")
    product = models.ForeignKey("orders.Product", on_delete=models.CASCADE, related_name="product_recipes")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["recipe", "product"], name="content_unique_recipe_product")
        ]


class FarmStory(models.Model):
    producer = models.ForeignKey(
        "orders.Producer", on_delete=models.CASCADE, related_name="farm_stories"
    )
    title = models.CharField(max_length=255)
    body = models.TextField()
    seasonal_tag = models.CharField(max_length=50, blank=True)
    image_url = models.URLField(blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class SavedRecipe(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_recipes")
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="saved_by_users")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "recipe"], name="content_unique_saved_recipe")]


class GeneratedContentSuggestion(models.Model):
    class ContentType(models.TextChoices):
        RECIPE = "recipe", "Recipe"
        STORY = "story", "Farm story"

    class Status(models.TextChoices):
        SAVED = "saved", "Saved"
        USED = "used", "Used"

    producer = models.ForeignKey(
        "orders.Producer", on_delete=models.CASCADE, related_name="generated_content_suggestions"
    )
    content_type = models.CharField(max_length=20, choices=ContentType.choices)
    products = models.ManyToManyField("orders.Product", related_name="generated_content_suggestions", blank=True)
    prompt_context = models.JSONField(default=dict, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    ingredients = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    body = models.TextField(blank=True)
    seasonal_tag = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SAVED)
    ai_disclosure = models.CharField(
        max_length=255,
        default="Generated with Vertex AI for producer review before publishing.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_content_type_display()}: {self.title}"
