"""
DESD Marketplace documentation.

File role:
    Documents expected behavior through automated tests for this app's public contract.

Domain context:
    Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.orders.models import Producer, Product

from .ai_services import GeneratedSuggestion
from .models import Recipe


User = get_user_model()


class ContentApiTests(APITestCase):
    """
    Documents the `ContentApiTests` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    def setUp(self):
        self.producer_user = User.objects.create_user(username="content_producer", password="pass1234")
        self.customer_user = User.objects.create_user(username="content_customer", password="pass1234")

        self.producer = Producer.objects.create(
            user=self.producer_user, business_name="Story Farm", postcode="BS1 4DJ"
        )
        self.product = Product.objects.create(
            producer=self.producer,
            name="Carrots",
            category="Vegetables",
            description="Fresh carrots harvested for seasonal boxes",
            unit="kg",
            price=Decimal("2.20"),
            stock_quantity=Decimal("20.00"),
            is_available=True,
            allergen_info="No common allergens",
        )
        self.other_producer_user = User.objects.create_user(username="other_content_producer", password="pass1234")
        self.other_producer = Producer.objects.create(
            user=self.other_producer_user, business_name="Other Farm", postcode="BS2 1AA"
        )
        self.other_product = Product.objects.create(
            producer=self.other_producer,
            name="Potatoes",
            unit="kg",
            price=Decimal("1.80"),
            stock_quantity=Decimal("12.00"),
            is_available=True,
        )

        self.producer_client = APIClient()
        self.producer_client.force_authenticate(self.producer_user)

        self.customer_client = APIClient()
        self.customer_client.force_authenticate(self.customer_user)

    def test_create_recipe_and_feed_visibility(self):
        create_res = self.producer_client.post(
            "/api/content/recipes/",
            {
                "title": "Roasted Root Vegetable Medley",
                "description": "Seasonal roast recipe",
                "ingredients": "Carrots, Parsnips, Potatoes",
                "instructions": "Roast at 200C for 35 minutes",
                "seasonal_tag": "Autumn/Winter",
                "product_ids": [self.product.id],
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)

        feed_res = self.customer_client.get("/api/content/feed/")
        self.assertEqual(feed_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(feed_res.data), 1)
        self.assertEqual(feed_res.data[0]["type"], "recipe")
        self.assertEqual(feed_res.data[0]["linked_products"][0]["id"], self.product.id)

    def test_product_recipes_and_save_toggle(self):
        recipe = Recipe.objects.create(
            producer=self.producer,
            title="Farm Soup",
            description="Simple soup",
            ingredients="Carrots, onions",
            instructions="Cook slowly",
            is_published=True,
        )
        recipe.recipe_products.create(product=self.product)

        recipes_res = self.customer_client.get(f"/api/content/products/{self.product.id}/recipes/")
        self.assertEqual(recipes_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(recipes_res.data), 1)

        save_res = self.customer_client.post(f"/api/content/recipes/{recipe.id}/save/")
        self.assertEqual(save_res.status_code, status.HTTP_200_OK)
        self.assertTrue(save_res.data["saved"])

    def test_producer_can_create_story_and_fetch_own_products_for_recipe_linking(self):
        story_res = self.producer_client.post(
            "/api/content/stories/",
            {
                "title": "Harvest Season Update",
                "body": "We finished this week's carrot harvest and updated cold storage guidance.",
                "seasonal_tag": "Autumn",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(story_res.status_code, status.HTTP_201_CREATED)

        producer_products_res = self.producer_client.get("/api/content/producer/products/")
        self.assertEqual(producer_products_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(producer_products_res.data), 1)
        self.assertEqual(producer_products_res.data[0]["id"], self.product.id)

    @patch("apps.content.views.generate_content_suggestions")
    def test_producer_can_generate_private_recipe_suggestions(self, mock_generate):
        mock_generate.return_value = [
            GeneratedSuggestion(
                title=f"Carrot Recipe {index}",
                description="A seasonal carrot dish",
                ingredients="Carrots\nOlive oil\nSalt",
                instructions="Roast until tender.",
                seasonal_tag="Autumn",
            )
            for index in range(1, 4)
        ]

        create_res = self.producer_client.post(
            "/api/content/ai/suggestions/",
            {
                "content_type": "recipe",
                "product_ids": [self.product.id],
                "notes": "Make it simple for families",
                "tone": "warm",
                "seasonal_tag": "Autumn",
            },
            format="json",
        )

        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(create_res.data), 2)
        self.assertEqual(create_res.data[0]["content_type"], "recipe")
        self.assertEqual(create_res.data[0]["status"], "saved")
        self.assertEqual(create_res.data[0]["products"][0]["id"], self.product.id)
        self.assertEqual(mock_generate.call_count, 1)

        list_res = self.producer_client.get("/api/content/ai/suggestions/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 2)

        replace_res = self.producer_client.post(
            "/api/content/ai/suggestions/",
            {
                "content_type": "recipe",
                "product_ids": [self.product.id],
                "notes": "Replace previous drafts",
                "tone": "clear",
            },
            format="json",
        )
        self.assertEqual(replace_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(replace_res.data), 2)

        replaced_list_res = self.producer_client.get("/api/content/ai/suggestions/")
        self.assertEqual(replaced_list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(replaced_list_res.data), 2)
        self.assertEqual(mock_generate.call_count, 2)

        feed_res = self.customer_client.get("/api/content/feed/")
        self.assertEqual(feed_res.status_code, status.HTTP_200_OK)
        self.assertEqual(feed_res.data, [])

    @patch("apps.content.views.generate_content_suggestions")
    def test_producer_can_generate_private_farm_story_suggestions(self, mock_generate):
        mock_generate.return_value = [
            GeneratedSuggestion(
                title=f"Harvest Story {index}",
                body="This week we lifted carrots for local kitchens.",
                seasonal_tag="Harvest",
            )
            for index in range(1, 4)
        ]

        create_res = self.producer_client.post(
            "/api/content/ai/suggestions/",
            {
                "content_type": "story",
                "product_ids": [self.product.id],
                "occasion": "weekly update",
                "storage_context": "Carrots keep well in a cool drawer.",
            },
            format="json",
        )

        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(create_res.data), 2)
        self.assertEqual(create_res.data[0]["content_type"], "story")
        self.assertIn("Harvest Story", create_res.data[0]["title"])
        self.assertIn("carrots", create_res.data[0]["body"].lower())

    def test_customer_cannot_generate_or_view_ai_suggestions(self):
        create_res = self.customer_client.post(
            "/api/content/ai/suggestions/",
            {"content_type": "recipe", "product_ids": [self.product.id]},
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_403_FORBIDDEN)

        list_res = self.customer_client.get("/api/content/ai/suggestions/")
        self.assertEqual(list_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_producer_cannot_generate_with_another_producers_product(self):
        create_res = self.producer_client.post(
            "/api/content/ai/suggestions/",
            {"content_type": "recipe", "product_ids": [self.other_product.id]},
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_vertex_config_returns_clear_unavailable_response(self):
        create_res = self.producer_client.post(
            "/api/content/ai/suggestions/",
            {"content_type": "recipe", "product_ids": [self.product.id]},
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("Vertex AI", create_res.data["detail"])

    @patch("apps.content.views.generate_content_suggestions")
    def test_producer_can_mark_ai_suggestion_used_and_delete_it(self, mock_generate):
        mock_generate.return_value = [
            GeneratedSuggestion(title=f"Carrot Recipe {index}", ingredients="Carrots", instructions="Cook")
            for index in range(1, 4)
        ]
        create_res = self.producer_client.post(
            "/api/content/ai/suggestions/",
            {"content_type": "recipe", "product_ids": [self.product.id]},
            format="json",
        )
        suggestion_id = create_res.data[0]["id"]

        patch_res = self.producer_client.patch(
            f"/api/content/ai/suggestions/{suggestion_id}/",
            {"status": "used"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data["status"], "used")

        delete_res = self.producer_client.delete(f"/api/content/ai/suggestions/{suggestion_id}/")
        self.assertEqual(delete_res.status_code, status.HTTP_204_NO_CONTENT)
