from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Producer, Product

from .models import FarmStory, Recipe, SavedRecipe
from .serializers import FarmStorySerializer, RecipeSerializer


def _get_request_producer(user) -> Producer | None:
    return Producer.objects.filter(user=user, is_active=True).first()


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
