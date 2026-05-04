"""
DESD Marketplace documentation.

File role:
    Validates API payloads and converts Django model instances into JSON-friendly response shapes.

Domain context:
    Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from rest_framework import serializers

from apps.orders.models import Producer, Product

from .models import FarmStory, GeneratedContentSuggestion, Recipe, RecipeProduct, SavedRecipe


class RecipeProductMiniSerializer(serializers.ModelSerializer):
    """
    Documents the `RecipeProductMiniSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = Product
        fields = ["id", "name", "unit", "price"]


class RecipeSerializer(serializers.ModelSerializer):
    """
    Documents the `RecipeSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer_name = serializers.CharField(source="producer.business_name", read_only=True)
    linked_products = serializers.SerializerMethodField()
    product_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    saved = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            "id",
            "producer",
            "producer_name",
            "title",
            "description",
            "ingredients",
            "instructions",
            "seasonal_tag",
            "image_url",
            "is_ai_generated",
            "is_published",
            "created_at",
            "linked_products",
            "product_ids",
            "saved",
        ]
        read_only_fields = ["created_at"]

    def get_linked_products(self, obj: Recipe):
        products = Product.objects.filter(product_recipes__recipe=obj).distinct()
        return RecipeProductMiniSerializer(products, many=True).data

    def get_saved(self, obj: Recipe) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return SavedRecipe.objects.filter(user=request.user, recipe=obj).exists()

    def create(self, validated_data):
        product_ids = validated_data.pop("product_ids", [])
        recipe = super().create(validated_data)
        self._sync_recipe_products(recipe, product_ids)
        return recipe

    def update(self, instance, validated_data):
        product_ids = validated_data.pop("product_ids", None)
        recipe = super().update(instance, validated_data)
        if product_ids is not None:
            self._sync_recipe_products(recipe, product_ids)
        return recipe

    def _sync_recipe_products(self, recipe: Recipe, product_ids: list[int]):
        RecipeProduct.objects.filter(recipe=recipe).delete()
        if not product_ids:
            return
        products = Product.objects.filter(id__in=product_ids, producer=recipe.producer)
        RecipeProduct.objects.bulk_create([RecipeProduct(recipe=recipe, product=p) for p in products])


class FarmStorySerializer(serializers.ModelSerializer):
    """
    Documents the `FarmStorySerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer_name = serializers.CharField(source="producer.business_name", read_only=True)

    class Meta:
        model = FarmStory
        fields = [
            "id",
            "producer",
            "producer_name",
            "title",
            "body",
            "seasonal_tag",
            "image_url",
            "is_ai_generated",
            "is_published",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class GeneratedContentSuggestionSerializer(serializers.ModelSerializer):
    """
    Documents the `GeneratedContentSuggestionSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    products = RecipeProductMiniSerializer(many=True, read_only=True)
    product_ids = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="products", many=True, write_only=True, required=False
    )

    class Meta:
        model = GeneratedContentSuggestion
        fields = [
            "id",
            "content_type",
            "products",
            "product_ids",
            "prompt_context",
            "title",
            "description",
            "ingredients",
            "instructions",
            "body",
            "seasonal_tag",
            "status",
            "ai_disclosure",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "products",
            "prompt_context",
            "title",
            "description",
            "ingredients",
            "instructions",
            "body",
            "seasonal_tag",
            "ai_disclosure",
            "created_at",
            "updated_at",
        ]
