from django.urls import path

from .views import (
    ContentFeedAPIView,
    FarmStoryDetailAPIView,
    FarmStoryListCreateAPIView,
    ProductRecipesAPIView,
    RecipeDetailAPIView,
    RecipeListCreateAPIView,
    ToggleSavedRecipeAPIView,
)

urlpatterns = [
    path("feed/", ContentFeedAPIView.as_view(), name="content-feed"),
    path("recipes/", RecipeListCreateAPIView.as_view(), name="content-recipes"),
    path("recipes/<int:recipe_id>/", RecipeDetailAPIView.as_view(), name="content-recipe-detail"),
    path("recipes/<int:recipe_id>/save/", ToggleSavedRecipeAPIView.as_view(), name="content-recipe-save"),
    path("stories/", FarmStoryListCreateAPIView.as_view(), name="content-stories"),
    path("stories/<int:story_id>/", FarmStoryDetailAPIView.as_view(), name="content-story-detail"),
    path("products/<int:product_id>/recipes/", ProductRecipesAPIView.as_view(), name="content-product-recipes"),
]
