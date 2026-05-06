"""
DESD Marketplace documentation.

File role:
    Validates API payloads and converts Django model instances into JSON-friendly response shapes.

Domain context:
    Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.community.models import ProductReview
from apps.community.review_policy import (
    get_review_eligibility,
    moderate_review_comment,
    resolve_verified_purchase_status,
)
from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    """
    Documents the `CategorySerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class ProductSerializer(serializers.ModelSerializer):
    """
    Documents the `ProductSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
    """
    Documents the `ProductReviewSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = ProductReview
        fields = [
            "id",
            "user_id",
            "title",
            "reviewer_name",
            "is_anonymous",
            "rating",
            "comment",
            "verified_purchase",
            "moderation_status",
            "moderation_reason",
            "producer_response",
            "producer_response_at",
            "created_at",
        ]


class ProductReviewCreateSerializer(serializers.ModelSerializer):
    """
    Documents the `ProductReviewCreateSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = ProductReview
        fields = ["rating", "title", "comment", "is_anonymous"]

    def validate_title(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Review title is required.")
        return cleaned

    def validate(self, attrs):
        request = self.context["request"]
        product = self.context["product"]
        user = request.user
        require_verified_purchase = self.context.get("require_verified_purchase", False)
        order_product = self.context.get("order_product")

        if not user or not user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication credentials were not provided."})

        if user.role != User.Role.CUSTOMER:
            raise serializers.ValidationError({"detail": "Only customers can submit reviews."})

        eligibility = get_review_eligibility(
            user=user,
            catalog_product=product,
            order_product=order_product,
            require_verified_purchase=require_verified_purchase,
        )
        if not eligibility.can_submit:
            raise serializers.ValidationError({"detail": eligibility.reason})

        attrs["_eligibility"] = eligibility

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        product = self.context["product"]
        user = request.user
        eligibility = validated_data.pop("_eligibility", None)
        customer_profile = getattr(user, "customer_profile", None)
        is_anonymous = bool(validated_data.get("is_anonymous"))
        reviewer_name = "Anonymous" if is_anonymous else ""
        if not reviewer_name:
            if customer_profile and getattr(customer_profile, "full_name", ""):
                reviewer_name = customer_profile.full_name.strip()
            if not reviewer_name:
                reviewer_name = user.email.split("@")[0]

        moderation_input = " ".join(
            part.strip()
            for part in [
                validated_data.get("title", ""),
                validated_data.get("comment", ""),
            ]
            if part and part.strip()
        )
        moderation = moderate_review_comment(moderation_input)

        return ProductReview.objects.create(
            product=product,
            user=user,
            title=validated_data["title"],
            reviewer_name=reviewer_name,
            is_anonymous=is_anonymous,
            rating=validated_data["rating"],
            comment=validated_data.get("comment", "").strip(),
            verified_purchase=bool(eligibility and eligibility.has_verified_purchase),
            moderation_status=moderation.status,
            moderation_reason=(
                "Waiting for approval."
                if moderation.status == ProductReview.ModerationStatus.PENDING
                else ""
            ),
        )


class ProductReviewUpdateSerializer(serializers.ModelSerializer):
    """Validate customer edits to their own product review."""

    class Meta:
        model = ProductReview
        fields = ["rating", "title", "comment", "is_anonymous"]

    def validate_title(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Review title is required.")
        return cleaned

    def update(self, instance: ProductReview, validated_data):
        is_anonymous = bool(validated_data.get("is_anonymous", instance.is_anonymous))
        instance.is_anonymous = is_anonymous
        if is_anonymous:
            instance.reviewer_name = "Anonymous"
        else:
            user = self.context["request"].user
            customer_profile = getattr(user, "customer_profile", None)
            reviewer_name = ""
            if customer_profile and getattr(customer_profile, "full_name", ""):
                reviewer_name = customer_profile.full_name.strip()
            instance.reviewer_name = reviewer_name or user.email.split("@")[0]
        instance.rating = validated_data.get("rating", instance.rating)
        instance.title = validated_data.get("title", instance.title).strip()
        instance.comment = validated_data.get("comment", instance.comment).strip()

        moderation_input = " ".join(
            part.strip()
            for part in [instance.title, instance.comment]
            if part and part.strip()
        )
        moderation = moderate_review_comment(moderation_input)
        instance.moderation_status = moderation.status
        instance.moderation_reason = (
            "Waiting for approval."
            if moderation.status == ProductReview.ModerationStatus.PENDING
            else ""
        )
        instance.save(
            update_fields=[
                "is_anonymous",
                "reviewer_name",
                "rating",
                "title",
                "comment",
                "moderation_status",
                "moderation_reason",
            ]
        )
        return instance


class ProductReviewProducerResponseSerializer(serializers.ModelSerializer):
    """
    Documents the `ProductReviewProducerResponseSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    producer_response = serializers.CharField(max_length=1000)

    class Meta:
        model = ProductReview
        fields = ["producer_response"]

    def validate_producer_response(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Producer response cannot be empty.")
        return cleaned

    def update(self, instance: ProductReview, validated_data):
        instance.producer_response = validated_data["producer_response"]
        instance.producer_response_at = timezone.now()
        instance.save(update_fields=["producer_response", "producer_response_at"])
        return instance


class ProductReviewModerationSerializer(serializers.ModelSerializer):
    """
    Documents the `ProductReviewModerationSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    moderation_status = serializers.ChoiceField(
        choices=[
            ProductReview.ModerationStatus.PUBLISHED,
            ProductReview.ModerationStatus.REJECTED,
        ]
    )
    moderation_reason = serializers.CharField(max_length=255, required=False, allow_blank=True)

    class Meta:
        model = ProductReview
        fields = ["moderation_status", "moderation_reason"]

    def update(self, instance: ProductReview, validated_data):
        moderation_status = validated_data["moderation_status"]
        moderation_reason = validated_data.get("moderation_reason", "").strip()

        instance.moderation_status = moderation_status
        instance.moderation_reason = moderation_reason

        update_fields = ["moderation_status", "moderation_reason"]
        if moderation_status == ProductReview.ModerationStatus.PUBLISHED:
            instance.verified_purchase = resolve_verified_purchase_status(
                user=instance.user,
                catalog_product=instance.product,
                order_product=self.context.get("order_product"),
            )
            update_fields.append("verified_purchase")

        instance.save(update_fields=update_fields)
        return instance
