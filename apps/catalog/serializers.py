from rest_framework import serializers

from apps.community.models import ProductReview
from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name", read_only=True)
    category_id = serializers.IntegerField(source="category.id", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    producer_id = serializers.IntegerField(source="producer.id", read_only=True)
    producer_name = serializers.CharField(source="producer.name", read_only=True)
    producer_location = serializers.CharField(source="producer.location", read_only=True)
    producer_description = serializers.CharField(source="producer.description", read_only=True)
    producer_delivery_lead_time = serializers.IntegerField(
        source="producer.delivery_lead_time", read_only=True
    )
    producer_postcode = serializers.CharField(source="producer.postcode", read_only=True)
    producer_latitude = serializers.SerializerMethodField()
    producer_longitude = serializers.SerializerMethodField()
    availability = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "price",
            "unit",
            "producer_id",
            "producer_name",
            "producer_location",
            "producer_description",
            "producer_delivery_lead_time",
            "producer_postcode",
            "producer_latitude",
            "producer_longitude",
            "category",
            "category_id",
            "category_slug",
            "harvest_date",
            "availability",
            "seasonal_dates",
            "is_organic",
            "organic_certification",
            "allergens",
            "image_url",
            "stock",
            "food_miles",
            "is_surplus",
            "surplus_discount",
            "surplus_original_price",
            "surplus_expires_at",
            "surplus_best_before",
            "storage_tips",
            "recipe_ideas",
        ]

    def get_producer_latitude(self, obj: Product) -> float | None:
        if obj.producer.latitude is None:
            return None
        return float(obj.producer.latitude)

    def get_producer_longitude(self, obj: Product) -> float | None:
        if obj.producer.longitude is None:
            return None
        return float(obj.producer.longitude)

    def get_availability(self, obj: Product) -> str:
        return obj.effective_availability()


class ProductReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductReview
        fields = [
            "id",
            "reviewer_name",
            "rating",
            "comment",
            "verified_purchase",
            "created_at",
        ]
