from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Producer, Product

from .ai_services import VertexAIResponseError, VertexAIUnavailable, generate_content_suggestions
from .models import FarmStory, GeneratedContentSuggestion, Recipe, SavedRecipe
from .serializers import FarmStorySerializer, GeneratedContentSuggestionSerializer, RecipeSerializer


def _get_request_producer(user) -> Producer | None:
    return Producer.objects.filter(user=user, is_active=True).first()


def _product_ai_payload(product: Product) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "description": product.description,
        "unit": product.unit,
        "price": str(product.price),
        "stock_quantity": str(product.stock_quantity),
        "is_available": product.is_available,
        "in_season": product.in_season,
        "seasonal_window": product.seasonal_window_label,
        "harvest_date": product.harvest_date.isoformat() if product.harvest_date else "",
        "allergen_info": product.allergen_info,
    }


def _prompt_context(request, producer: Producer, seasonal_tag: str) -> dict:
    return {
        "producer": {
            "business_name": producer.business_name,
            "postcode": producer.postcode,
        },
        "notes": str(request.data.get("notes", "")).strip(),
        "tone": str(request.data.get("tone", "")).strip(),
        "occasion": str(request.data.get("occasion", "")).strip(),
        "storage_context": str(request.data.get("storage_context", "")).strip(),
        "seasonal_tag": seasonal_tag,
    }


class ContentFeedAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recipes = Recipe.objects.filter(is_published=True).select_related("producer")
        stories = FarmStory.objects.filter(is_published=True).select_related("producer")

        combined = []
        for recipe in recipes:
            combined.append(
                {
                    "type": "recipe",
                    "id": recipe.id,
                    "title": recipe.title,
                    "description": recipe.description,
                    "producer_name": recipe.producer.business_name,
                    "seasonal_tag": recipe.seasonal_tag,
                    "created_at": recipe.created_at,
                }
            )
        for story in stories:
            combined.append(
                {
                    "type": "story",
                    "id": story.id,
                    "title": story.title,
                    "description": story.body[:300],
                    "producer_name": story.producer.business_name,
                    "seasonal_tag": story.seasonal_tag,
                    "created_at": story.created_at,
                }
            )

        combined.sort(key=lambda row: row["created_at"], reverse=True)
        return Response(combined)


class RecipeListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Recipe.objects.select_related("producer").all()
        if request.query_params.get("mine") == "true":
            producer = _get_request_producer(request.user)
            if not producer:
                return Response([], status=status.HTTP_200_OK)
            queryset = queryset.filter(producer=producer)
        else:
            queryset = queryset.filter(is_published=True)
        return Response(RecipeSerializer(queryset, many=True, context={"request": request}).data)

    def post(self, request):
        producer = _get_request_producer(request.user)
        if not producer:
            return Response(
                {"detail": "Only producers can publish recipes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        payload = request.data.copy()
        payload["producer"] = producer.id
        serializer = RecipeSerializer(data=payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        recipe = serializer.save()
        return Response(
            RecipeSerializer(recipe, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class RecipeDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, recipe_id: int):
        recipe = get_object_or_404(Recipe.objects.select_related("producer"), id=recipe_id)
        producer = _get_request_producer(request.user)
        if not recipe.is_published and (not producer or recipe.producer_id != producer.id):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(RecipeSerializer(recipe, context={"request": request}).data)

    def patch(self, request, recipe_id: int):
        producer = _get_request_producer(request.user)
        recipe = get_object_or_404(Recipe, id=recipe_id)
        if not producer or recipe.producer_id != producer.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        serializer = RecipeSerializer(recipe, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, recipe_id: int):
        producer = _get_request_producer(request.user)
        recipe = get_object_or_404(Recipe, id=recipe_id)
        if not producer or recipe.producer_id != producer.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        recipe.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FarmStoryListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = FarmStory.objects.select_related("producer").all()
        if request.query_params.get("mine") == "true":
            producer = _get_request_producer(request.user)
            if not producer:
                return Response([], status=status.HTTP_200_OK)
            queryset = queryset.filter(producer=producer)
        else:
            queryset = queryset.filter(is_published=True)

        return Response(FarmStorySerializer(queryset, many=True).data)

    def post(self, request):
        producer = _get_request_producer(request.user)
        if not producer:
            return Response(
                {"detail": "Only producers can publish farm stories."},
                status=status.HTTP_403_FORBIDDEN,
            )
        payload = request.data.copy()
        payload["producer"] = producer.id
        serializer = FarmStorySerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        story = serializer.save()
        return Response(FarmStorySerializer(story).data, status=status.HTTP_201_CREATED)


class FarmStoryDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, story_id: int):
        story = get_object_or_404(FarmStory.objects.select_related("producer"), id=story_id)
        producer = _get_request_producer(request.user)
        if not story.is_published and (not producer or story.producer_id != producer.id):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(FarmStorySerializer(story).data)

    def patch(self, request, story_id: int):
        producer = _get_request_producer(request.user)
        story = get_object_or_404(FarmStory, id=story_id)
        if not producer or story.producer_id != producer.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        serializer = FarmStorySerializer(story, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, story_id: int):
        producer = _get_request_producer(request.user)
        story = get_object_or_404(FarmStory, id=story_id)
        if not producer or story.producer_id != producer.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        story.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductRecipesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id: int):
        product = get_object_or_404(Product, id=product_id)
        recipes = Recipe.objects.filter(recipe_products__product=product, is_published=True).distinct()
        return Response(RecipeSerializer(recipes, many=True, context={"request": request}).data)


class ProducerOwnedProductsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        producer = _get_request_producer(request.user)
        if not producer:
            return Response(
                {"detail": "Only producers can view producer-linked products."},
                status=status.HTTP_403_FORBIDDEN,
            )

        products = Product.objects.filter(producer=producer).order_by("name")
        payload = [
            {
                "id": product.id,
                "name": product.name,
                "unit": product.unit,
                "price": product.price,
                "is_available": product.is_available,
                "stock_quantity": product.stock_quantity,
            }
            for product in products
        ]
        return Response(payload)


class GeneratedContentSuggestionListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        producer = _get_request_producer(request.user)
        if not producer:
            return Response(
                {"detail": "Only producers can view AI content suggestions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        suggestions = GeneratedContentSuggestion.objects.filter(producer=producer).prefetch_related("products")
        return Response(GeneratedContentSuggestionSerializer(suggestions, many=True).data)

    def post(self, request):
        producer = _get_request_producer(request.user)
        if not producer:
            return Response(
                {"detail": "Only producers can generate AI content suggestions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        content_type = str(request.data.get("content_type", "")).strip()
        if content_type not in GeneratedContentSuggestion.ContentType.values:
            return Response(
                {"detail": "content_type must be recipe or story."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_product_ids = request.data.get("product_ids", [])
        if not isinstance(raw_product_ids, list) or not raw_product_ids:
            return Response(
                {"detail": "Select at least one producer product."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        product_ids = []
        for product_id in raw_product_ids:
            try:
                product_ids.append(int(product_id))
            except (TypeError, ValueError):
                return Response(
                    {"detail": "product_ids must contain only product IDs."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        products = list(Product.objects.filter(id__in=product_ids, producer=producer).order_by("name"))
        if len({product.id for product in products}) != len(set(product_ids)):
            return Response(
                {"detail": "One or more selected products are unavailable for this producer."},
                status=status.HTTP_403_FORBIDDEN,
            )

        seasonal_tag = str(request.data.get("seasonal_tag", "")).strip()
        context = _prompt_context(request, producer, seasonal_tag)
        product_payloads = [_product_ai_payload(product) for product in products]

        try:
            generated = generate_content_suggestions(
                content_type=content_type,
                products=product_payloads,
                context=context,
            )
        except VertexAIUnavailable as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except VertexAIResponseError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        with transaction.atomic():
            suggestions = []
            for item in generated:
                suggestion = GeneratedContentSuggestion.objects.create(
                    producer=producer,
                    content_type=content_type,
                    prompt_context=context,
                    title=item.title,
                    description=item.description,
                    ingredients=item.ingredients,
                    instructions=item.instructions,
                    body=item.body,
                    seasonal_tag=item.seasonal_tag or seasonal_tag,
                )
                suggestion.products.set(products)
                suggestions.append(suggestion)

        return Response(
            GeneratedContentSuggestionSerializer(suggestions, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class GeneratedContentSuggestionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_suggestion(self, request, suggestion_id: int):
        producer = _get_request_producer(request.user)
        if not producer:
            return None, Response(
                {"detail": "Only producers can manage AI content suggestions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        suggestion = get_object_or_404(
            GeneratedContentSuggestion.objects.prefetch_related("products"),
            id=suggestion_id,
            producer=producer,
        )
        return suggestion, None

    def patch(self, request, suggestion_id: int):
        suggestion, error = self._get_suggestion(request, suggestion_id)
        if error is not None:
            return error

        next_status = str(request.data.get("status", "")).strip()
        if next_status not in GeneratedContentSuggestion.Status.values:
            return Response(
                {"detail": "status must be saved or used."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        suggestion.status = next_status
        suggestion.save(update_fields=["status", "updated_at"])
        return Response(GeneratedContentSuggestionSerializer(suggestion).data)

    def delete(self, request, suggestion_id: int):
        suggestion, error = self._get_suggestion(request, suggestion_id)
        if error is not None:
            return error
        suggestion.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ToggleSavedRecipeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, recipe_id: int):
        recipe = get_object_or_404(Recipe, id=recipe_id, is_published=True)
        saved = SavedRecipe.objects.filter(user=request.user, recipe=recipe).first()
        if saved:
            saved.delete()
            return Response({"saved": False})
        SavedRecipe.objects.create(user=request.user, recipe=recipe)
        return Response({"saved": True})
