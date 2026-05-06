"""
DESD Marketplace documentation.

File role:
    Documents expected behavior through automated tests for this app's public contract.

Domain context:
    Catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog APIs.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from calendar import month_name
from datetime import date
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import CustomerProfile, User
from apps.catalog.models import Category, Producer, Product
from apps.community.models import ProductReview
from apps.orders.models import (
    Order,
    OrderItem,
    Producer as OrdersProducer,
    ProducerSubOrder,
    Product as OrdersProduct,
)


class ProductApiTests(APITestCase):
    """
    Documents the `ProductApiTests` boundary for this module.

    The class belongs to the file role described above: Documents expected behavior through automated tests for this app's public contract.
    It keeps related behavior grouped so the catalog domain: public product browsing, producer/product data serialization, reviews, and marketplace-facing catalog apis.
    can be changed without spreading the same responsibility across unrelated files.
    """
    @staticmethod
    def _out_of_season_range(reference_month: int) -> str:
        start_month = (reference_month % 12) + 1
        end_month = ((reference_month + 1) % 12) + 1
        return f"{month_name[start_month]} - {month_name[end_month]}"

    def setUp(self):
        self.vegetables = Category.objects.create(name="Vegetables", slug="vegetables")
        self.dairy = Category.objects.create(name="Dairy Products", slug="dairy")

        self.green_valley = Producer.objects.create(
            name="Green Valley Farm",
            location="Kent, UK",
            delivery_lead_time=48,
        )
        self.sunrise = Producer.objects.create(
            name="Sunrise Dairy",
            location="Devon, UK",
            delivery_lead_time=72,
        )

        self.tomatoes = Product.objects.create(
            name="Organic Tomatoes",
            description="Vine-ripened seasonal tomatoes",
            price=Decimal("4.50"),
            unit=Product.Unit.KG,
            producer=self.green_valley,
            category=self.vegetables,
            harvest_date=date(2026, 2, 14),
            availability=Product.Availability.IN_SEASON,
            seasonal_dates=self._out_of_season_range(date.today().month),
            is_organic=True,
            organic_certification="Soil Association",
            allergens=[],
            stock=50,
            food_miles=12,
            image_url="https://example.com/tomatoes.jpg",
        )
        self.milk = Product.objects.create(
            name="Fresh Whole Milk",
            description="Whole milk from grass-fed cows",
            price=Decimal("2.80"),
            unit=Product.Unit.LITRE,
            producer=self.sunrise,
            category=self.dairy,
            harvest_date=date(2026, 2, 15),
            availability=Product.Availability.YEAR_ROUND,
            is_organic=False,
            allergens=["Milk"],
            stock=80,
            food_miles=40,
            image_url="https://example.com/milk.jpg",
        )

        ProductReview.objects.create(
            product=self.tomatoes,
            reviewer_name="Jane Customer",
            rating=5,
            comment="Excellent quality",
            verified_purchase=True,
        )
        ProductReview.objects.create(
            product=self.tomatoes,
            reviewer_name="Community Kitchen",
            rating=4,
            comment="Worked well in bulk orders",
            verified_purchase=False,
        )

        self.customer_user = User.objects.create_user(
            email="reviewer@example.com",
            password="DemoPass123!",
            role=User.Role.CUSTOMER,
            email_verified=True,
        )
        CustomerProfile.objects.create(
            user=self.customer_user,
            full_name="Reviewing Customer",
            phone="07123456789",
        )

        self.producer_user = User.objects.create_user(
            email="producer-review@example.com",
            password="DemoPass123!",
            role=User.Role.PRODUCER,
            email_verified=True,
        )

        self.orders_producer = OrdersProducer.objects.create(
            business_name="Sunrise Dairy",
            postcode="BS1 4DJ",
            lead_time_hours=48,
        )
        self.orders_milk = OrdersProduct.objects.create(
            producer=self.orders_producer,
            name="Fresh Whole Milk",
            category="Dairy Products",
            description="Whole milk from grass-fed cows",
            unit="litre",
            price=Decimal("2.80"),
            stock_quantity=Decimal("80.00"),
            is_available=True,
            in_season=True,
            allergen_info="Milk",
        )

    def _seed_delivered_purchase_for_milk(self):
        order = Order.objects.create(
            customer=self.customer_user,
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            delivery_address="45 Park Street, Bristol",
            customer_postcode="BS1 5JG",
            special_instructions="Delivered review verification",
            subtotal_amount=Decimal("2.80"),
            commission_rate=Decimal("0.05"),
            commission_amount=Decimal("0.14"),
            total_amount=Decimal("2.80"),
            producer_payout_total=Decimal("2.66"),
            payment_method="test_card",
            payment_reference="PAY-MILK-1",
        )
        sub_order = ProducerSubOrder.objects.create(
            order=order,
            producer=self.orders_producer,
            status=Order.Status.DELIVERED,
            delivery_date=timezone.localdate(),
            subtotal_amount=Decimal("2.80"),
            commission_amount=Decimal("0.14"),
            payout_amount=Decimal("2.66"),
            notes="Delivered milk review order",
        )
        OrderItem.objects.create(
            order=order,
            sub_order=sub_order,
            product=self.orders_milk,
            product_name=self.orders_milk.name,
            producer_name=self.orders_producer.business_name,
            unit=self.orders_milk.unit,
            quantity=Decimal("1.00"),
            unit_price=self.orders_milk.price,
            line_total=Decimal("2.80"),
        )

    def test_products_support_category_filter_by_slug(self):
        response = self.client.get("/api/products", {"category": "vegetables"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Organic Tomatoes")

    def test_products_support_category_filter_by_id(self):
        response = self.client.get("/api/products", {"category": str(self.vegetables.id)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Organic Tomatoes")

    def test_products_support_search_by_name_description_and_producer(self):
        producer_response = self.client.get("/api/products", {"search": "green valley"})
        self.assertEqual(producer_response.status_code, 200)
        self.assertEqual(len(producer_response.data), 1)
        self.assertEqual(producer_response.data[0]["name"], "Organic Tomatoes")

        description_response = self.client.get("/api/products", {"search": "grass-fed"})
        self.assertEqual(description_response.status_code, 200)
        self.assertEqual(len(description_response.data), 1)
        self.assertEqual(description_response.data[0]["name"], "Fresh Whole Milk")

    def test_products_support_search_by_allergen_terms(self):
        response = self.client.get("/api/products", {"search": "milk"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Fresh Whole Milk")

    def test_products_support_combined_category_organic_and_search_filters(self):
        response = self.client.get(
            "/api/products",
            {"category": "vegetables", "organic": "true", "search": "tomato"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Organic Tomatoes")

    def test_products_support_typo_tolerant_search(self):
        tomato_response = self.client.get("/api/products", {"search": "tomatos"})
        self.assertEqual(tomato_response.status_code, 200)
        self.assertEqual(len(tomato_response.data), 1)
        self.assertEqual(tomato_response.data[0]["name"], "Organic Tomatoes")

        producer_response = self.client.get("/api/products", {"search": "gren valey"})
        self.assertEqual(producer_response.status_code, 200)
        self.assertEqual(len(producer_response.data), 1)
        self.assertEqual(producer_response.data[0]["name"], "Organic Tomatoes")

        empty_response = self.client.get("/api/products", {"search": "zzzz"})
        self.assertEqual(empty_response.status_code, 200)
        self.assertEqual(len(empty_response.data), 0)

    def test_products_support_organic_boolean_filter_values(self):
        organic_response = self.client.get("/api/products", {"organic": "true"})
        self.assertEqual(organic_response.status_code, 200)
        self.assertEqual(len(organic_response.data), 1)
        self.assertEqual(organic_response.data[0]["name"], "Organic Tomatoes")

        non_organic_response = self.client.get("/api/products", {"organic": "false"})
        self.assertEqual(non_organic_response.status_code, 200)
        self.assertEqual(len(non_organic_response.data), 1)
        self.assertEqual(non_organic_response.data[0]["name"], "Fresh Whole Milk")

    def test_products_support_price_filters(self):
        response = self.client.get("/api/products", {"max_price": "3.00"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Fresh Whole Milk")

    def test_in_stock_filter_excludes_out_of_season_products(self):
        response = self.client.get("/api/products", {"in_stock": "true"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Fresh Whole Milk")

    def test_availability_filter_uses_effective_seasonal_status(self):
        response = self.client.get("/api/products", {"availability": Product.Availability.UNAVAILABLE})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Organic Tomatoes")

    def test_product_detail_contains_compliance_fields(self):
        response = self.client.get(f"/api/products/{self.milk.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["allergens"], ["Milk"])
        self.assertEqual(response.data["availability"], Product.Availability.YEAR_ROUND)
        self.assertFalse(response.data["is_organic"])

    def test_product_reviews_endpoint_returns_read_only_list(self):
        response = self.client.get(f"/api/products/{self.tomatoes.id}/reviews")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertIn("reviewer_name", response.data[0])
        self.assertIn("rating", response.data[0])
        self.assertIn("verified_purchase", response.data[0])

    def test_customer_can_submit_product_review_once(self):
        self._seed_delivered_purchase_for_milk()
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.post(
            f"/api/products/{self.milk.id}/reviews",
            {"rating": 5, "title": "Excellent quality", "comment": "Very fresh and creamy."},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "Excellent quality")
        self.assertEqual(response.data["reviewer_name"], "Reviewing Customer")
        self.assertEqual(response.data["rating"], 5)
        self.assertTrue(response.data["verified_purchase"])
        self.assertEqual(response.data["user_id"], self.customer_user.id)
        self.assertEqual(response.data["moderation_status"], "published")

        duplicate = self.client.post(
            f"/api/products/{self.milk.id}/reviews",
            {"rating": 4, "title": "Second attempt", "comment": "Second attempt."},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("already reviewed", str(duplicate.data).lower())

    def test_non_customer_cannot_submit_review(self):
        self.client.force_authenticate(user=self.producer_user)
        response = self.client.post(
            f"/api/products/{self.tomatoes.id}/reviews",
            {"rating": 5, "title": "Should fail", "comment": "Should fail."},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_anonymous_user_cannot_submit_review(self):
        response = self.client.post(
            f"/api/products/{self.tomatoes.id}/reviews",
            {"rating": 5, "title": "Should fail", "comment": "Should fail."},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
