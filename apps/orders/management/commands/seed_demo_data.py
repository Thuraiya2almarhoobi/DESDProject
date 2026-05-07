"""
DESD Marketplace documentation.

File role:
    Source module for the orders area.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This command seeds deterministic assessment/demo data across the application.
    It deliberately uses mock payments and pre-authored AI-labelled content; it
    never calls external payment, email, Google Places, or Vertex AI services.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import (
    Address,
    CommunityGroupProfile,
    CustomerProfile as AccountCustomerProfile,
    ProducerProfile,
    RestaurantProfile,
    compose_customer_full_name,
)
from apps.catalog.models import Product as CatalogProduct
from apps.community.models import ProductReview
from apps.content.models import FarmStory, GeneratedContentSuggestion, Recipe, RecipeProduct, SavedRecipe
from apps.moderation.models import ModerationAction, ModerationReport
from apps.moderation.services import create_report, keep_reported_target, remove_reported_target
from apps.orders.marketplace_sync import get_or_create_catalog_product_mirror, sync_orders_product_from_producer_product
from apps.orders.models import (
    Cart,
    CartItem,
    CustomerProfile as OrdersCustomerProfile,
    FavoriteProducer,
    Order,
    OrderItem,
    PaymentTransaction,
    Producer,
    ProducerNotification,
    ProducerSubOrder,
    ProducerSubOrderStatusHistory,
    Product,
    ProductAllergenAcknowledgement,
    RecurringOrderInstanceOverride,
    RecurringOrderInstanceOverrideItem,
    RecurringOrderTemplate,
    RecurringOrderTemplateItem,
    UserNotification,
)
from apps.orders.services import create_order_notifications
from apps.payments.models import SettlementOrderLine, SettlementStatus, WeeklySettlement
from apps.payments.services import get_previous_week_range, process_weekly_settlements
from apps.producer_portal.models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
    ProducerProductInventoryEvent,
    ProductAvailability,
)

PASSWORD = "DemoPass123!"
COMMISSION_RATE = Decimal("0.05")


class Command(BaseCommand):
    help = "Seed deterministic TC-001 to TC-025 demo data across the application."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=PASSWORD, help="Password used for all seeded demo accounts.")
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Flush application database data before seeding the deterministic demo dataset.",
        )

    def handle(self, *args, **options):
        password = options["password"]
        if options["reset"]:
            self.stdout.write(self.style.WARNING("Resetting database with Django flush before seeding demo data..."))
            call_command("flush", interactive=False, verbosity=0)

        with transaction.atomic():
            seeded = DemoSeeder(password=password)
            seeded.seed_all()

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
        seeded.print_summary(self.stdout, self.style)


class DemoSeeder:
    def __init__(self, *, password: str):
        self.password = password
        self.User = get_user_model()
        self.users: dict[str, object] = {}
        self.orders_producers: dict[str, Producer] = {}
        self.portal_products: dict[str, ProducerProduct] = {}
        self.products: dict[str, Product] = {}
        self.catalog_products: dict[str, CatalogProduct] = {}
        self.recipes: dict[str, Recipe] = {}
        self.stories: dict[str, FarmStory] = {}
        self.reviews: dict[str, ProductReview] = {}
        self.login_rows: list[tuple[str, str, str]] = []

    def seed_all(self) -> None:
        self.seed_accounts()
        self.seed_products()
        self.seed_carts_and_acknowledgements()
        self.seed_orders_and_payments()
        self.seed_recurring_orders()
        self.seed_settlements()
        self.seed_content()
        self.seed_reviews()
        self.seed_favorites_notifications_and_inventory_events()
        self.seed_moderation()

    def upsert_user(self, email: str, *, role: str, label: str, is_staff=False, is_superuser=False):
        user = self.User.objects.filter(email__iexact=email).first()
        if user is None:
            user = self.User.objects.create_user(
                email=email,
                password=self.password,
                role=role,
                is_staff=is_staff,
                is_superuser=is_superuser,
                email_verified=True,
            )
        user.email = email
        user.role = role
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.is_active = True
        user.email_verified = True
        user.set_password(self.password)
        user.save(update_fields=["email", "role", "is_staff", "is_superuser", "is_active", "email_verified", "password"])
        self.users[email] = user
        self.login_rows.append((email, role, label))
        return user

    def upsert_address(self, user, *, label: str, line1: str, city: str = "Bristol", postcode: str, line2: str = ""):
        Address.objects.filter(user=user, label=label).exclude(is_default=True).delete()
        address, _ = Address.objects.update_or_create(
            user=user,
            label=label,
            defaults={"line1": line1, "line2": line2, "city": city, "postcode": postcode, "is_default": True},
        )
        Address.objects.filter(user=user).exclude(pk=address.pk).update(is_default=False)
        return address

    def seed_accounts(self) -> None:
        admin = self.upsert_user("admin@example.com", role=self.User.Role.ADMIN, label="Admin", is_staff=True, is_superuser=True)

        producer_specs = [
            ("producer@example.com", "Bristol Valley Farm", "Jane", "", "Smith", "01179 123456", "Unit 5 Farm Lane", "BS1 4DJ", "Fresh seasonal produce from Bristol growers near the city centre.", 48),
            ("producer2@example.com", "Hillside Dairy", "Harvey", "", "Milker", "01179 001122", "18 Dairy Lane", "BS3 2AA", "Milk, yogurt, cheese, and eggs prepared for local delivery.", 72),
            ("clifton.market.garden@example.com", "Clifton Market Garden", "Priya", "", "Gardener", "01179 772211", "Clifton Down Station, Whiteladies Road", "BS8 2PN", "Leafy vegetables, herbs, and soft fruit grown for short Bristol routes.", 48),
            ("harbour.bakery@example.com", "Harbour Bakery", "Oliver", "", "Baker", "01179 556677", "Wapping Wharf", "BS1 6WE", "Daily bread, pastries, and catering bakery boxes from Bristol harbour.", 48),
            ("avon.orchards@example.com", "Avon Orchards", "Megan", "", "Orchard", "01179 888321", "Ashton Court Estate", "BS41 9JN", "Apples, pears, juices, preserves, and seasonal orchard produce.", 48),
        ]
        for email, business, first, middle, last, phone, line1, postcode, origin, lead in producer_specs:
            user = self.upsert_user(email, role=self.User.Role.PRODUCER, label=business)
            address = self.upsert_address(user, label="Business Address", line1=line1, postcode=postcode)
            ProducerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "business_name": business,
                    "contact_first_name": first,
                    "contact_middle_name": middle,
                    "contact_last_name": last,
                    "contact_name": compose_customer_full_name(first, middle, last),
                    "phone": phone,
                    "farm_origin_text": origin,
                    "lead_time_hours": lead,
                    "address": address,
                },
            )
            producer, _ = Producer.objects.update_or_create(
                user=user,
                defaults={
                    "business_name": business,
                    "contact_email": email,
                    "phone": phone,
                    "postcode": postcode,
                    "lead_time_hours": lead,
                    "is_active": True,
                },
            )
            self.orders_producers[email] = producer

        customer_specs = [
            ("customer@example.com", "Demo", "", "Customer", "07700 900123", "45 Park Street", "BS1 5JG", "No walnuts", "Organic vegetables, family meals"),
            ("robert.johnson@email.com", "Robert", "", "Johnson", "07700 900124", "45 Park Street", "BS1 5JG", "", "Quick weekday meals"),
            ("amelia.carter@example.com", "Amelia", "Rose", "Carter", "07700 900125", "10 Cabot Circus", "BS1 3BX", "Peanuts", "Surplus deals and fruit"),
            ("samira.patel@example.com", "Samira", "", "Patel", "07700 900126", "M Shed, Princes Wharf", "BS1 4RN", "Milk", "Vegan-friendly produce"),
            ("morgan.family@example.com", "Morgan", "", "Family", "07700 900127", "Bristol Museum & Art Gallery, Queens Road", "BS8 1RL", "", "School lunchbox ingredients"),
        ]
        for email, first, middle, last, phone, line1, postcode, allergies, prefs in customer_specs:
            user = self.upsert_user(email, role=self.User.Role.CUSTOMER, label=compose_customer_full_name(first, middle, last))
            address = self.upsert_address(user, label="Delivery Address", line1=line1, postcode=postcode)
            AccountCustomerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "first_name": first,
                    "middle_name": middle,
                    "last_name": last,
                    "full_name": compose_customer_full_name(first, middle, last),
                    "phone": phone,
                    "allergies_text": allergies,
                    "preferences_text": prefs,
                    "default_address": address,
                },
            )
            OrdersCustomerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "full_name": compose_customer_full_name(first, middle, last),
                    "phone": phone,
                    "delivery_address": f"{line1}, Bristol",
                    "postcode": postcode,
                },
            )

        community_specs = [
            ("community@example.com", "Community Pantry", "Community Group", "Nadia", "", "Organiser", "07700 900128", "18 Park Row", "BS1 5LJ"),
            ("catering@stmarys-school.org.uk", "St. Mary's School", "Education", "Lucy", "", "Kitchen", "07700 900129", "St Mary Redcliffe and Temple School, Somerset Square", "BS1 6RT"),
            ("east.bristol.coop@example.com", "East Bristol Food Co-op", "Community Co-op", "Elliot", "", "Reed", "07700 900130", "Easton Community Centre, Kilburn Street", "BS5 6AW"),
            ("redland.residents@example.com", "Redland Residents Food Club", "Residents Association", "Maya", "", "Lewis", "07700 900131", "Redland Library, Whiteladies Road", "BS6 6TN"),
            ("bristol.foodhub@example.com", "Bristol Food Hub", "Food Charity", "Daniel", "", "Green", "07700 900132", "The Station, Silver Street", "BS1 2AG"),
        ]
        for email, org, org_type, first, middle, last, phone, line1, postcode in community_specs:
            user = self.upsert_user(email, role=self.User.Role.COMMUNITY, label=org)
            address = self.upsert_address(user, label="Delivery Address", line1=line1, postcode=postcode)
            CommunityGroupProfile.objects.update_or_create(
                user=user,
                defaults={
                    "organisation_name": org,
                    "org_type": org_type,
                    "contact_first_name": first,
                    "contact_middle_name": middle,
                    "contact_last_name": last,
                    "contact_name": compose_customer_full_name(first, middle, last),
                    "phone": phone,
                    "delivery_address": address,
                },
            )

        restaurant_specs = [
            ("restaurant@example.com", "Harbourside Restaurant", "Marco", "", "Chef", "07700 900133", "14 Harbourside", "BS1 5UH"),
            ("chef@thecliftonkitchen.co.uk", "The Clifton Kitchen", "Grace", "", "Taylor", "07700 900134", "The Mall, Clifton Village", "BS8 4JG"),
            ("harbourside.restaurant@example.com", "Harbourside Seasonal Table", "Rosa", "", "Mendez", "07700 900135", "Millennium Square", "BS1 5DB"),
            ("northbristol.cafe@example.com", "North Bristol Cafe", "Theo", "", "Bennett", "07700 900136", "Gloucester Road", "BS7 8BN"),
            ("oldmarket.deli@example.com", "Old Market Deli", "Aisha", "", "Khan", "07700 900137", "Old Market Street", "BS2 0EZ"),
        ]
        for email, business, first, middle, last, phone, line1, postcode in restaurant_specs:
            user = self.upsert_user(email, role=self.User.Role.RESTAURANT, label=business)
            address = self.upsert_address(user, label="Delivery Address", line1=line1, postcode=postcode)
            RestaurantProfile.objects.update_or_create(
                user=user,
                defaults={
                    "business_name": business,
                    "contact_first_name": first,
                    "contact_middle_name": middle,
                    "contact_last_name": last,
                    "contact_name": compose_customer_full_name(first, middle, last),
                    "phone": phone,
                    "delivery_address": address,
                },
            )

    def seed_products(self) -> None:
        today = timezone.localdate()
        now = timezone.now()
        products = [
            # Bristol Valley Farm
            ("producer@example.com", "Organic Tomatoes", "Vegetables", "Organic vine-ripened tomatoes grown for salads, sauces, and Bristol market boxes.", "kg", "4.50", 100, True, "Soil Association", "No common allergens", "Keep at room temperature and use within five days for best flavour.", True, ProductAvailability.IN_SEASON, 5, 10, False, None, None, "", "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=900"),
            ("producer@example.com", "Organic Carrots", "Vegetables", "Sweet organic carrots harvested fresh for roasting, soups, and school catering orders.", "kg", "1.80", 120, True, "Soil Association", "No common allergens", "Keep chilled in a breathable bag and use within ten days.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=900"),
            ("producer@example.com", "Parsnips", "Vegetables", "Fresh parsnips ideal for roasting and seasonal root vegetable medleys.", "kg", "2.10", 80, False, "", "No common allergens", "Store in the fridge drawer and use within one week.", False, ProductAvailability.IN_SEASON, 10, 3, False, None, None, "", "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=900"),
            ("producer@example.com", "Potatoes", "Vegetables", "Locally grown potatoes suitable for bulk, restaurant, and household orders.", "kg", "1.40", 300, False, "", "No common allergens", "Store in a dark cool cupboard away from onions.", True, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=900"),
            ("producer@example.com", "Lettuce", "Vegetables", "Crisp lettuce heads harvested for same-week local delivery and surplus offers.", "each", "1.60", 50, False, "", "No common allergens", "Keep refrigerated and rinse just before serving.", False, ProductAvailability.IN_SEASON, 5, 9, True, 30, now + timedelta(hours=48), "Perfect condition, must sell quickly to avoid waste.", "https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=900"),
            ("producer@example.com", "Early Asparagus", "Vegetables", "Tender asparagus spears prepared for spring menus and local produce boxes.", "kg", "5.80", 6, False, "", "No common allergens", "Stand upright in a little water or wrap cut ends in damp paper before chilling.", True, ProductAvailability.IN_SEASON, 6, 7, False, None, None, "Early crop preview for seasonal reminder demos.", "https://images.unsplash.com/photo-1515471209610-dae1c92d8777?w=900"),
            ("producer@example.com", "Stored Potatoes", "Vegetables", "Stored main-crop potatoes available year-round for reliable catering menus.", "kg", "1.25", 180, False, "", "No common allergens", "Store in a cool dark place and check weekly.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=900"),
            # Hillside Dairy
            ("producer2@example.com", "Fresh Milk", "Dairy Products", "Pasteurised whole milk from grass-fed local herds for households and catering.", "litre", "1.95", 200, False, "", "Milk", "Keep refrigerated below 5C and consume within three days of opening.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=900"),
            ("producer2@example.com", "Cheddar Cheese", "Dairy Products", "Mature cheddar made with local milk and aged for a full flavour.", "each", "6.90", 50, False, "", "Milk", "Keep wrapped and refrigerated; bring to room temperature before serving.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=900"),
            ("producer2@example.com", "Organic Greek Yogurt", "Dairy Products", "Thick organic yogurt from grass-fed dairy for breakfasts, sauces, and catering.", "each", "3.60", 60, True, "Soil Association", "Milk", "Keep refrigerated and use within three days of opening.", True, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900"),
            ("producer2@example.com", "Organic Free Range Eggs", "Dairy Products", "Fresh organic eggs from free-range hens, collected daily for Bristol orders.", "dozen", "3.50", 9, True, "Organic Farmers & Growers", "Eggs", "Keep refrigerated after delivery and use by the date on the box.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=900"),
            ("producer2@example.com", "Butter Portions", "Dairy Products", "Salted butter portions prepared for cafes and weekly restaurant ordering.", "each", "2.80", 75, False, "", "Milk", "Keep chilled and sealed until use.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=900"),
            # Clifton Market Garden
            ("clifton.market.garden@example.com", "Strawberries", "Fruit", "Sweet seasonal strawberries grown for early summer Bristol boxes.", "kg", "5.50", 40, True, "Organic Farmers & Growers", "No common allergens", "Keep refrigerated unwashed and eat within two days.", True, ProductAvailability.IN_SEASON, 6, 8, False, None, None, "", "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=900"),
            ("clifton.market.garden@example.com", "Baby Spinach", "Vegetables", "Tender organic spinach leaves for salads, sides, and smoothies.", "kg", "2.40", 75, True, "Organic Farmers & Growers", "No common allergens", "Keep chilled and use within three days.", False, ProductAvailability.IN_SEASON, 3, 10, False, None, None, "", "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=900"),
            ("clifton.market.garden@example.com", "Basil Bunches", "Herbs", "Fresh basil bunches for pasta, salads, and kitchen service.", "each", "1.75", 45, False, "", "No common allergens", "Stand stems in water or wrap loosely in damp paper.", False, ProductAvailability.IN_SEASON, 5, 9, False, None, None, "", "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=900"),
            ("clifton.market.garden@example.com", "Courgettes", "Vegetables", "Fresh courgettes harvested young for grilling, roasting, and pasta dishes.", "kg", "2.20", 65, False, "", "No common allergens", "Keep chilled and use within five days.", False, ProductAvailability.IN_SEASON, 6, 9, False, None, None, "", "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=900"),
            ("clifton.market.garden@example.com", "Winter Squash", "Vegetables", "Dense winter squash for soups, roasting, and long storage.", "each", "3.20", 0, False, "", "No common allergens", "Store whole in a cool dry place for several weeks.", False, ProductAvailability.UNAVAILABLE, None, None, False, None, None, "Currently unavailable after the winter season.", "https://images.unsplash.com/photo-1506917728037-b6af01a7d403?w=900"),
            # Harbour Bakery
            ("harbour.bakery@example.com", "Walnut Bread", "Bakery", "Artisan bread loaf with walnuts and whole wheat flour baked near the harbour.", "each", "4.20", 60, False, "", "Wheat (Gluten), Nuts (Walnuts)", "Keep wrapped at room temperature and use within two days.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900"),
            ("harbour.bakery@example.com", "Sourdough Loaf", "Bakery", "Slow-fermented sourdough loaf with a crisp crust and open crumb.", "each", "3.80", 55, False, "", "Wheat (Gluten)", "Keep cut-side down at room temperature and toast after day two.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=900"),
            ("harbour.bakery@example.com", "Seeded Rolls", "Bakery", "Seeded bakery rolls prepared for cafes, school lunches, and community orders.", "each", "0.95", 140, False, "", "Wheat (Gluten), Sesame", "Store covered and use within two days.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900"),
            ("harbour.bakery@example.com", "Apple Turnovers", "Bakery", "Flaky apple turnovers made with Avon orchard apples and butter pastry.", "each", "2.40", 36, False, "", "Wheat (Gluten), Milk", "Keep chilled if not eaten same day and rewarm gently.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=900"),
            ("harbour.bakery@example.com", "Focaccia Tray", "Bakery", "Olive oil focaccia tray for restaurant service and sharing platters.", "each", "9.50", 12, False, "", "Wheat (Gluten)", "Best eaten same day; refresh in a warm oven before service.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=900"),
            ("harbour.bakery@example.com", "Banana Bread", "Bakery", "Soft banana bread baked for cafes, lunchboxes, and breakfast menus.", "each", "3.40", 28, False, "", "Wheat (Gluten), Eggs", "Keep wrapped at room temperature and eat within three days.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1605286978633-2dec93ff88a2?w=900"),
            # Avon Orchards
            ("avon.orchards@example.com", "Fresh Apples", "Fruit", "Crisp Bristol-region apples picked for lunchboxes, snacks, and desserts.", "kg", "2.60", 110, False, "", "No common allergens", "Keep in a cool drawer and separate any bruised fruit.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=900"),
            ("avon.orchards@example.com", "Conference Pears", "Fruit", "Juicy conference pears from Avon orchards for seasonal fruit boxes.", "kg", "2.90", 90, False, "", "No common allergens", "Ripen at room temperature then refrigerate.", False, ProductAvailability.IN_SEASON, 9, 2, False, None, None, "", "https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?w=900"),
            ("avon.orchards@example.com", "Apple Juice", "Preserves", "Pressed apple juice bottled from mixed orchard varieties.", "litre", "3.25", 70, False, "", "No common allergens", "Keep chilled after opening and use within five days.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=900"),
            ("avon.orchards@example.com", "Plum Jam", "Preserves", "Small-batch plum jam for breakfasts, baking, and gift boxes.", "each", "4.10", 42, False, "", "No common allergens", "Store in a cool cupboard and refrigerate after opening.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=900"),
            ("avon.orchards@example.com", "Pear Chutney", "Preserves", "Spiced pear chutney made for cheese boards and deli menus.", "each", "4.40", 38, False, "", "Mustard", "Store unopened in a cool cupboard; refrigerate after opening.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=900"),
        ]

        for row in products:
            (
                producer_email,
                name,
                category,
                description,
                unit,
                price,
                stock,
                is_organic,
                certification,
                allergens,
                storage,
                storage_ai,
                availability,
                season_start,
                season_end,
                is_surplus,
                discount,
                surplus_expires,
                surplus_note,
                image_url,
            ) = row
            product, _ = ProducerProduct.objects.update_or_create(
                producer=self.users[producer_email],
                name=name,
                defaults={
                    "category": category,
                    "description": description,
                    "price": Decimal(price),
                    "unit": unit,
                    "availability": availability,
                    "season_start_month": season_start,
                    "season_end_month": season_end,
                    "stock_quantity": stock,
                    "low_stock_threshold": 10,
                    "is_organic": is_organic,
                    "organic_certification": certification,
                    "allergen_information": allergens,
                    "no_known_allergens_confirmed": allergens.strip().lower() == "no common allergens",
                    "storage_tips": storage,
                    "storage_tips_ai_generated": storage_ai,
                    "harvest_date": today,
                    "image_url": image_url,
                    "is_surplus": is_surplus,
                    "surplus_discount_percent": discount,
                    "surplus_expires_at": surplus_expires,
                    "surplus_best_before": "3 days" if is_surplus else "",
                    "surplus_note": surplus_note,
                },
            )
            self.portal_products[f"{producer_email}:{name}"] = product
            order_product = sync_orders_product_from_producer_product(product)
            self.products[name] = order_product
            self.catalog_products[name] = get_or_create_catalog_product_mirror(order_product)

        # Add more marketplace/category volume so directory, filters, and search feel complete.
        extras = [
            ("producer@example.com", "Rainbow Chard", "Vegetables", "Colourful chard bunches for sautés and seasonal boxes.", "kg", "2.70", 58, False, "", "No common allergens", "Keep chilled and use stems and leaves separately.", False, ProductAvailability.IN_SEASON, 4, 11, False, None, None, "", "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=900"),
            ("producer2@example.com", "Cream", "Dairy Products", "Rich dairy cream for restaurants, baking, and desserts.", "litre", "4.80", 40, False, "", "Milk", "Keep refrigerated and use within two days of opening.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=900"),
            ("clifton.market.garden@example.com", "Cherry Tomatoes", "Vegetables", "Small sweet tomatoes for salads, pasta, and lunch boxes.", "kg", "4.90", 64, False, "", "No common allergens", "Keep at room temperature until fully ripe.", False, ProductAvailability.IN_SEASON, 5, 10, False, None, None, "", "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=900"),
            ("harbour.bakery@example.com", "Rye Tin Loaf", "Bakery", "Dense rye loaf for delis and breakfast menus.", "each", "3.60", 32, False, "", "Rye (Gluten)", "Wrap well and slice as needed.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900"),
            ("avon.orchards@example.com", "Apple Crisps", "Fruit", "Dried apple crisps made from surplus orchard fruit.", "each", "2.20", 55, False, "", "No common allergens", "Keep sealed and dry after opening.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=900"),
            ("avon.orchards@example.com", "Bananas", "Fruit", "Ripe bananas supplied for cafes, lunchboxes, smoothies, and baking.", "kg", "1.90", 84, False, "", "No common allergens", "Keep at room temperature and separate from delicate fruit as they ripen.", False, ProductAvailability.YEAR_ROUND, None, None, False, None, None, "", "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=900"),
        ]
        for row in extras:
            products.append(row)
            producer_email, name, category, description, unit, price, stock, is_organic, certification, allergens, storage, storage_ai, availability, season_start, season_end, is_surplus, discount, surplus_expires, surplus_note, image_url = row
            product, _ = ProducerProduct.objects.update_or_create(
                producer=self.users[producer_email],
                name=name,
                defaults={
                    "category": category,
                    "description": description,
                    "price": Decimal(price),
                    "unit": unit,
                    "availability": availability,
                    "season_start_month": season_start,
                    "season_end_month": season_end,
                    "stock_quantity": stock,
                    "low_stock_threshold": 10,
                    "is_organic": is_organic,
                    "organic_certification": certification,
                    "allergen_information": allergens,
                    "no_known_allergens_confirmed": allergens.strip().lower() == "no common allergens",
                    "storage_tips": storage,
                    "storage_tips_ai_generated": storage_ai,
                    "harvest_date": today,
                    "image_url": image_url,
                    "is_surplus": is_surplus,
                    "surplus_discount_percent": discount,
                    "surplus_expires_at": surplus_expires,
                    "surplus_best_before": "",
                    "surplus_note": surplus_note,
                },
            )
            self.portal_products[f"{producer_email}:{name}"] = product
            order_product = sync_orders_product_from_producer_product(product)
            self.products[name] = order_product
            self.catalog_products[name] = get_or_create_catalog_product_mirror(order_product)

    def seed_carts_and_acknowledgements(self) -> None:
        cart_specs = {
            "customer@example.com": [("Organic Carrots", "2.00"), ("Fresh Milk", "3.00")],
            "robert.johnson@email.com": [("Organic Tomatoes", "1.50"), ("Walnut Bread", "1.00")],
            "community@example.com": [("Potatoes", "50.00"), ("Fresh Milk", "30.00"), ("Organic Carrots", "20.00")],
            "restaurant@example.com": [("Baby Spinach", "8.00"), ("Sourdough Loaf", "6.00"), ("Cheddar Cheese", "4.00")],
            "chef@thecliftonkitchen.co.uk": [("Fresh Milk", "12.00"), ("Basil Bunches", "10.00")],
        }
        for email, items in cart_specs.items():
            cart, _ = Cart.objects.get_or_create(customer=self.users[email])
            CartItem.objects.filter(cart=cart).delete()
            for product_name, quantity in items:
                CartItem.objects.create(cart=cart, product=self.products[product_name], quantity=Decimal(quantity))

        for email in ["customer@example.com", "robert.johnson@email.com", "restaurant@example.com", "community@example.com"]:
            for product_name in ["Fresh Milk", "Cheddar Cheese", "Organic Free Range Eggs", "Walnut Bread"]:
                ProductAllergenAcknowledgement.objects.get_or_create(user=self.users[email], product=self.products[product_name])

    def money(self, value) -> Decimal:
        return Decimal(value).quantize(Decimal("0.01"))

    def create_order(
        self,
        *,
        order_number: str,
        customer_email: str,
        status: str,
        payment_status: str,
        payment_reference: str,
        delivery_address: str,
        postcode: str,
        special_instructions: str,
        created_at,
        suborders: list[dict],
        recurring_template=None,
        is_recurring_instance=False,
    ) -> Order:
        subtotal = self.money(sum(self.money(row["subtotal"]) for row in suborders))
        commission = self.money(subtotal * COMMISSION_RATE)
        payout = self.money(subtotal - commission)
        order, _ = Order.objects.update_or_create(
            order_number=order_number,
            defaults={
                "customer": self.users[customer_email],
                "recurring_template": recurring_template,
                "is_recurring_instance": is_recurring_instance,
                "recurring_scheduled_for": created_at.date() if is_recurring_instance else None,
                "status": status,
                "payment_status": payment_status,
                "delivery_address": delivery_address,
                "customer_postcode": postcode,
                "special_instructions": special_instructions,
                "subtotal_amount": subtotal,
                "commission_rate": COMMISSION_RATE,
                "commission_amount": commission,
                "total_amount": subtotal,
                "producer_payout_total": payout,
                "payment_method": "test_card" if payment_status == Order.PaymentStatus.PAID else "stripe_checkout",
                "payment_reference": payment_reference,
            },
        )
        existing_suborders = ProducerSubOrder.objects.filter(order=order)
        SettlementOrderLine.objects.filter(sub_order__in=existing_suborders).delete()
        ProducerSubOrder.objects.filter(order=order).delete()
        OrderItem.objects.filter(order=order).delete()

        for sub in suborders:
            producer = self.orders_producers[sub["producer_email"]]
            sub_total = self.money(sub["subtotal"])
            sub_commission = self.money(sub_total * COMMISSION_RATE)
            sub_payout = self.money(sub_total - sub_commission)
            sub_order = ProducerSubOrder.objects.create(
                order=order,
                producer=producer,
                status=sub.get("status", status),
                delivery_date=sub["delivery_date"],
                subtotal_amount=sub_total,
                commission_amount=sub_commission,
                payout_amount=sub_payout,
                notes=sub.get("notes", "Seeded demo sub-order"),
            )
            previous = Order.Status.PENDING
            for next_status, note in sub.get("history", []):
                ProducerSubOrderStatusHistory.objects.create(
                    sub_order=sub_order,
                    actor=producer.user,
                    previous_status=previous,
                    new_status=next_status,
                    note=note,
                )
                previous = next_status
            for item in sub["items"]:
                product = self.products[item["product"]]
                quantity = Decimal(str(item["quantity"]))
                unit_price = Decimal(str(item.get("unit_price", product.price)))
                line_total = self.money(quantity * unit_price)
                OrderItem.objects.create(
                    order=order,
                    sub_order=sub_order,
                    product=product,
                    product_name=product.name,
                    producer_name=producer.business_name,
                    product_image_url=product.image_url,
                    allergen_info=product.allergen_info,
                    is_organic=product.is_organic,
                    organic_certification=product.organic_certification,
                    is_surplus=product.is_surplus,
                    surplus_discount_percent=product.surplus_discount_percent,
                    surplus_original_unit_price=product.price if product.is_surplus else None,
                    surplus_best_before=product.surplus_best_before,
                    surplus_note=product.surplus_note,
                    unit=product.unit,
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                )
        payment, _ = PaymentTransaction.objects.update_or_create(
            order=order,
            defaults={
                "provider": "mock" if payment_status == Order.PaymentStatus.PAID else "stripe",
                "provider_reference": payment_reference,
                "amount": subtotal,
                "currency": "GBP",
                "status": "succeeded" if payment_status == Order.PaymentStatus.PAID else ("failed" if payment_status == Order.PaymentStatus.FAILED else "pending"),
                "test_mode": True,
                "raw_payload": {"seeded": True, "order_number": order_number},
            },
        )
        Order.objects.filter(pk=order.pk).update(created_at=created_at, updated_at=created_at)
        PaymentTransaction.objects.filter(pk=payment.pk).update(created_at=created_at + timedelta(minutes=3))
        return Order.objects.get(pk=order.pk)

    def seed_orders_and_payments(self) -> None:
        now = timezone.now()
        addr = "45 Park Street, Bristol, BS1 5JG"
        # Customer order history: at least 3 completed orders, including Organic Tomatoes for review eligibility.
        self.create_order(
            order_number="ORD-DEMO-0001",
            customer_email="customer@example.com",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-DEMO-0001-SECRET",
            delivery_address=addr,
            postcode="BS1 5JG",
            special_instructions="Leave with concierge if not home.",
            created_at=now - timedelta(days=21),
            suborders=[{"producer_email": "producer@example.com", "delivery_date": (now - timedelta(days=18)).date(), "status": Order.Status.DELIVERED, "subtotal": "18.00", "history": [(Order.Status.CONFIRMED, "Order confirmed."), (Order.Status.READY, "Ready for delivery."), (Order.Status.DELIVERED, "Delivered successfully.")], "items": [{"product": "Organic Tomatoes", "quantity": "2.00", "unit_price": "4.50"}, {"product": "Organic Carrots", "quantity": "5.00", "unit_price": "1.80"}]}],
        )
        self.create_order(
            order_number="ORD-DEMO-0002",
            customer_email="customer@example.com",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-DEMO-0002-SECRET",
            delivery_address=addr,
            postcode="BS1 5JG",
            special_instructions="Ring on arrival.",
            created_at=now - timedelta(days=14),
            suborders=[{"producer_email": "producer2@example.com", "delivery_date": (now - timedelta(days=11)).date(), "status": Order.Status.DELIVERED, "subtotal": "15.60", "history": [(Order.Status.CONFIRMED, "Dairy order accepted."), (Order.Status.READY, "Packed chilled."), (Order.Status.DELIVERED, "Delivered chilled.")], "items": [{"product": "Fresh Milk", "quantity": "4.00", "unit_price": "1.95"}, {"product": "Cheddar Cheese", "quantity": "1.00", "unit_price": "6.90"}, {"product": "Organic Greek Yogurt", "quantity": "0.25", "unit_price": "3.60"}]}],
        )
        self.create_order(
            order_number="ORD-DEMO-0003",
            customer_email="customer@example.com",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-DEMO-0003-SECRET",
            delivery_address=addr,
            postcode="BS1 5JG",
            special_instructions="Family weekly box.",
            created_at=now - timedelta(days=7),
            suborders=[{"producer_email": "harbour.bakery@example.com", "delivery_date": (now - timedelta(days=5)).date(), "status": Order.Status.DELIVERED, "subtotal": "8.00", "history": [(Order.Status.CONFIRMED, "Bakery order accepted."), (Order.Status.READY, "Baked this morning."), (Order.Status.DELIVERED, "Delivered fresh.")], "items": [{"product": "Walnut Bread", "quantity": "1.00", "unit_price": "4.20"}, {"product": "Sourdough Loaf", "quantity": "1.00", "unit_price": "3.80"}]}],
        )
        # Operational state examples.
        self.create_order(
            order_number="ORD-DEMO-PENDING",
            customer_email="robert.johnson@email.com",
            status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-DEMO-PENDING",
            delivery_address=addr,
            postcode="BS1 5JG",
            special_instructions="Pending producer confirmation.",
            created_at=now - timedelta(hours=6),
            suborders=[{"producer_email": "producer@example.com", "delivery_date": (now + timedelta(days=3)).date(), "status": Order.Status.PENDING, "subtotal": "22.00", "items": [{"product": "Organic Tomatoes", "quantity": "2.00", "unit_price": "4.50"}, {"product": "Potatoes", "quantity": "9.29", "unit_price": "1.40"}]}],
        )
        self.create_order(
            order_number="ORD-DEMO-URGENT",
            customer_email="community@example.com",
            status=Order.Status.CONFIRMED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-DEMO-URGENT",
            delivery_address="18 Park Row, Bristol, BS1 5LJ",
            postcode="BS1 5LJ",
            special_instructions="Urgent demo delivery due tomorrow morning.",
            created_at=now - timedelta(hours=10),
            suborders=[
                {
                    "producer_email": "producer@example.com",
                    "delivery_date": (now + timedelta(hours=18)).date(),
                    "status": Order.Status.CONFIRMED,
                    "subtotal": "24.70",
                    "history": [(Order.Status.CONFIRMED, "Urgent community order accepted.")],
                    "items": [
                        {"product": "Lettuce", "quantity": "4.00", "unit_price": "1.60"},
                        {"product": "Organic Tomatoes", "quantity": "3.00", "unit_price": "4.50"},
                        {"product": "Early Asparagus", "quantity": "0.83", "unit_price": "5.80"},
                    ],
                }
            ],
        )
        self.create_order(
            order_number="ORD-DEMO-REVIEW-READY",
            customer_email="robert.johnson@email.com",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-DEMO-REVIEW-READY",
            delivery_address=addr,
            postcode="BS1 5JG",
            special_instructions="Delivered tomatoes order reserved for write-review testing.",
            created_at=now - timedelta(days=9),
            suborders=[
                {
                    "producer_email": "producer@example.com",
                    "delivery_date": (now - timedelta(days=7)).date(),
                    "status": Order.Status.DELIVERED,
                    "subtotal": "13.50",
                    "history": [
                        (Order.Status.CONFIRMED, "Review demo order confirmed."),
                        (Order.Status.READY, "Review demo order ready."),
                        (Order.Status.DELIVERED, "Review demo order delivered."),
                    ],
                    "items": [{"product": "Organic Tomatoes", "quantity": "3.00", "unit_price": "4.50"}],
                }
            ],
        )
        self.create_order(
            order_number="ORD-DEMO-READY",
            customer_email="amelia.carter@example.com",
            status=Order.Status.READY,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-DEMO-READY",
            delivery_address="10 Cabot Circus, Bristol, BS1 3BX",
            postcode="BS1 3BX",
            special_instructions="Ready order for tracking demo.",
            created_at=now - timedelta(days=2),
            suborders=[{"producer_email": "clifton.market.garden@example.com", "delivery_date": (now + timedelta(days=1)).date(), "status": Order.Status.READY, "subtotal": "19.60", "history": [(Order.Status.CONFIRMED, "Accepted by producer."), (Order.Status.READY, "Packed and ready.")], "items": [{"product": "Baby Spinach", "quantity": "4.00", "unit_price": "2.40"}, {"product": "Basil Bunches", "quantity": "4.00", "unit_price": "1.75"}]}],
        )
        self.create_order(
            order_number="ORD-DEMO-CANCELLED",
            customer_email="samira.patel@example.com",
            status=Order.Status.CANCELLED,
            payment_status=Order.PaymentStatus.FAILED,
            payment_reference="PAY-DEMO-FAILED",
            delivery_address="M Shed, Princes Wharf, Bristol, BS1 4RN",
            postcode="BS1 4RN",
            special_instructions="Failed payment example.",
            created_at=now - timedelta(days=1),
            suborders=[{"producer_email": "avon.orchards@example.com", "delivery_date": (now + timedelta(days=2)).date(), "status": Order.Status.CANCELLED, "subtotal": "16.40", "history": [(Order.Status.CANCELLED, "Payment failed before fulfilment.")], "items": [{"product": "Plum Jam", "quantity": "4.00", "unit_price": "4.10"}]}],
        )
        self.create_order(
            order_number="ORD-DEMO-PAYPENDING",
            customer_email="morgan.family@example.com",
            status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PENDING,
            payment_reference="STRIPE-DEMO-PENDING",
            delivery_address="Bristol Museum & Art Gallery, Queens Road, Bristol, BS8 1RL",
            postcode="BS8 1RL",
            special_instructions="Stripe reservation pending example.",
            created_at=now - timedelta(hours=2),
            suborders=[{"producer_email": "avon.orchards@example.com", "delivery_date": (now + timedelta(days=3)).date(), "status": Order.Status.PENDING, "subtotal": "13.00", "items": [{"product": "Fresh Apples", "quantity": "5.00", "unit_price": "2.60"}]}],
        )
        # Community bulk order from 3 producers.
        self.create_order(
            order_number="ORD-BULK-STMARYS",
            customer_email="catering@stmarys-school.org.uk",
            status=Order.Status.CONFIRMED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-BULK-STMARYS",
            delivery_address="St Mary Redcliffe and Temple School, Somerset Square, Bristol, BS1 6RT",
            postcode="BS1 6RT",
            special_instructions="Delivery to kitchen entrance, contact kitchen manager.",
            created_at=now - timedelta(days=3),
            suborders=[
                {"producer_email": "producer@example.com", "delivery_date": (now + timedelta(days=2)).date(), "status": Order.Status.CONFIRMED, "subtotal": "98.00", "history": [(Order.Status.CONFIRMED, "Bulk vegetables accepted.")], "items": [{"product": "Potatoes", "quantity": "50.00", "unit_price": "1.40"}, {"product": "Organic Carrots", "quantity": "20.00", "unit_price": "1.40"}]},
                {"producer_email": "producer2@example.com", "delivery_date": (now + timedelta(days=3)).date(), "status": Order.Status.CONFIRMED, "subtotal": "58.50", "history": [(Order.Status.CONFIRMED, "Milk reserved for school order.")], "items": [{"product": "Fresh Milk", "quantity": "30.00", "unit_price": "1.95"}]},
                {"producer_email": "harbour.bakery@example.com", "delivery_date": (now + timedelta(days=2)).date(), "status": Order.Status.CONFIRMED, "subtotal": "28.50", "history": [(Order.Status.CONFIRMED, "Rolls scheduled for bake day.")], "items": [{"product": "Seeded Rolls", "quantity": "30.00", "unit_price": "0.95"}]},
            ],
        )
        # Exact admin commission examples previous week.
        week = get_previous_week_range(timezone.localdate())
        created_100 = timezone.make_aware(datetime.combine(week.start + timedelta(days=1), time(10, 0)))
        created_150 = timezone.make_aware(datetime.combine(week.start + timedelta(days=2), time(11, 0)))
        self.create_order(
            order_number="ORD-COMM-100",
            customer_email="customer@example.com",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-REF-100",
            delivery_address="The Station, Silver Street, Bristol, BS1 2AG",
            postcode="BS1 2AG",
            special_instructions="Admin reporting reference order.",
            created_at=created_100,
            suborders=[{"producer_email": "producer@example.com", "delivery_date": week.start + timedelta(days=3), "status": Order.Status.DELIVERED, "subtotal": "100.00", "history": [(Order.Status.CONFIRMED, "Confirmed."), (Order.Status.READY, "Ready."), (Order.Status.DELIVERED, "Delivered.")], "items": [{"product": "Organic Carrots", "quantity": "55.56", "unit_price": "1.80"}]}],
        )
        self.create_order(
            order_number="ORD-COMM-150",
            customer_email="customer@example.com",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-REF-150",
            delivery_address="Bristol Old Vic, King Street, Bristol, BS1 4ED",
            postcode="BS1 4ED",
            special_instructions="Admin multi-vendor reporting reference order.",
            created_at=created_150,
            suborders=[
                {"producer_email": "producer@example.com", "delivery_date": week.start + timedelta(days=4), "status": Order.Status.DELIVERED, "subtotal": "80.00", "history": [(Order.Status.CONFIRMED, "Confirmed."), (Order.Status.READY, "Ready."), (Order.Status.DELIVERED, "Delivered.")], "items": [{"product": "Potatoes", "quantity": "57.14", "unit_price": "1.40"}]},
                {"producer_email": "producer2@example.com", "delivery_date": week.start + timedelta(days=4), "status": Order.Status.DELIVERED, "subtotal": "70.00", "history": [(Order.Status.CONFIRMED, "Confirmed."), (Order.Status.READY, "Ready."), (Order.Status.DELIVERED, "Delivered.")], "items": [{"product": "Fresh Milk", "quantity": "35.90", "unit_price": "1.95"}]},
            ],
        )

    def seed_settlements(self) -> None:
        SettlementOrderLine.objects.all().delete()
        WeeklySettlement.objects.all().delete()
        for sub_order in ProducerSubOrder.objects.all():
            sub_order.settlement_processed = False
            sub_order.save(update_fields=["settlement_processed", "updated_at"])

        status_cycle = [
            SettlementStatus.PAID,
            SettlementStatus.PROCESSED,
            SettlementStatus.PROCESSING,
            SettlementStatus.PENDING_BANK_TRANSFER,
            SettlementStatus.FAILED,
        ]
        grouped: dict[tuple[int, date, date], list[ProducerSubOrder]] = {}
        sub_orders = (
            ProducerSubOrder.objects.select_related("producer__user", "order", "order__customer")
            .filter(order__payment_status=Order.PaymentStatus.PAID)
            .order_by("order__created_at", "id")
        )
        for sub_order in sub_orders:
            created_date = timezone.localtime(sub_order.order.created_at).date()
            week_start = created_date - timedelta(days=created_date.weekday())
            week_end = week_start + timedelta(days=6)
            grouped.setdefault((sub_order.producer.user_id, week_start, week_end), []).append(sub_order)

        for index, ((producer_user_id, week_start, week_end), lines) in enumerate(sorted(grouped.items(), key=lambda item: (item[0][1], item[0][0]))):
            producer_user = self.User.objects.get(pk=producer_user_id)
            gross = self.money(sum(line.subtotal_amount for line in lines))
            commission = self.money(gross * COMMISSION_RATE)
            net = self.money(gross - commission)
            settlement = WeeklySettlement.objects.create(
                producer=producer_user,
                week_start=week_start,
                week_end=week_end,
                gross_amount=gross,
                commission_amount=commission,
                net_amount=net,
                status=status_cycle[index % len(status_cycle)],
                transaction_reference=f"SET-{week_start:%Y%m%d}-{producer_user_id}",
            )
            for sub_order in lines:
                SettlementOrderLine.objects.create(
                    settlement=settlement,
                    sub_order=sub_order,
                    customer_name=self.customer_display_name(sub_order.order.customer),
                    gross_amount=sub_order.subtotal_amount,
                    commission_amount=sub_order.commission_amount,
                    net_amount=sub_order.payout_amount,
                )
                sub_order.settlement_processed = settlement.status in {SettlementStatus.PAID, SettlementStatus.PROCESSED}
                sub_order.save(update_fields=["settlement_processed", "updated_at"])

    def customer_display_name(self, user) -> str:
        profile = getattr(user, "orders_customer_profile", None)
        if profile and profile.full_name:
            return profile.full_name
        return (user.email or "Customer").split("@")[0].replace(".", " ").title()

    def seed_recurring_orders(self) -> None:
        restaurant = self.users["restaurant@example.com"]
        template_defaults = {
            "frequency": RecurringOrderTemplate.Frequency.WEEKLY,
            "order_day": 0,
            "delivery_day": 2,
            "next_order_date": timezone.localdate() + timedelta(days=(7 - timezone.localdate().weekday()) % 7),
            "delivery_address": "Harbourside Restaurant, 14 Harbourside, Bristol, BS1 5UH",
            "customer_postcode": "BS1 5UH",
            "payment_method": "test_card",
            "is_paused": False,
            "is_cancelled": False,
        }
        template = RecurringOrderTemplate.objects.filter(
            restaurant=restaurant,
            delivery_address=template_defaults["delivery_address"],
        ).first()
        if template is None:
            template = RecurringOrderTemplate.objects.create(restaurant=restaurant, **template_defaults)
        else:
            for field, value in template_defaults.items():
                setattr(template, field, value)
            template.save(update_fields=[*template_defaults.keys(), "updated_at"])
        RecurringOrderTemplateItem.objects.filter(template=template).delete()
        for product_name, quantity in [
            ("Organic Tomatoes", "6.00"),
            ("Organic Carrots", "12.00"),
            ("Lettuce", "10.00"),
            ("Sourdough Loaf", "8.00"),
        ]:
            RecurringOrderTemplateItem.objects.create(template=template, product=self.products[product_name], default_quantity=Decimal(quantity))
        override, _ = RecurringOrderInstanceOverride.objects.update_or_create(
            template=template,
            scheduled_order_date=template.next_order_date,
            defaults={"created_by": restaurant},
        )
        RecurringOrderInstanceOverrideItem.objects.filter(override=override).delete()
        RecurringOrderInstanceOverrideItem.objects.create(override=override, product=self.products["Organic Tomatoes"], quantity=Decimal("8.00"))
        RecurringOrderInstanceOverrideItem.objects.create(override=override, product=self.products["Lettuce"], quantity=Decimal("12.00"))
        # keep recurring demo data on the main restaurant and producer accounts
        recurring_order = self.create_order(
            order_number="ORD-RECUR-HARBOURSIDE-1",
            customer_email="restaurant@example.com",
            status=Order.Status.CONFIRMED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-RECUR-HARBOURSIDE-1",
            delivery_address=template.delivery_address,
            postcode=template.customer_postcode,
            special_instructions="Weekly standing order for Wednesday restaurant prep.",
            created_at=timezone.now() - timedelta(days=4),
            recurring_template=template,
            is_recurring_instance=True,
            suborders=[
                {"producer_email": "producer@example.com", "delivery_date": timezone.localdate() + timedelta(days=2), "status": Order.Status.CONFIRMED, "subtotal": "64.00", "history": [(Order.Status.CONFIRMED, "Recurring Harbourside produce order accepted.")], "items": [{"product": "Organic Tomatoes", "quantity": "8.00", "unit_price": "4.50"}, {"product": "Organic Carrots", "quantity": "12.00", "unit_price": "1.80"}, {"product": "Lettuce", "quantity": "4.00", "unit_price": "1.60"}]},
                {"producer_email": "harbour.bakery@example.com", "delivery_date": timezone.localdate() + timedelta(days=2), "status": Order.Status.CONFIRMED, "subtotal": "30.40", "history": [(Order.Status.CONFIRMED, "Recurring bakery order accepted.")], "items": [{"product": "Sourdough Loaf", "quantity": "8.00", "unit_price": "3.80"}]},
            ],
        )
        recurring_order.payment_terms = "recurring_card_payment_per_instance"
        recurring_order.save(update_fields=["payment_terms", "updated_at"])
        producer_sub_order = recurring_order.sub_orders.filter(producer=self.orders_producers["producer@example.com"]).first()
        if producer_sub_order:
            ProducerNotification.objects.update_or_create(
                producer=self.orders_producers["producer@example.com"],
                sub_order=producer_sub_order,
                category="recurring_order",
                defaults={
                    "message": (
                        f"Advance notice: recurring restaurant order {recurring_order.order_number} "
                        f"from Harbourside Restaurant is scheduled for {producer_sub_order.delivery_date}."
                    ),
                    "metadata": {
                        "order_id": recurring_order.id,
                        "template_id": template.id,
                        "restaurant_email": "restaurant@example.com",
                        "scheduled_order_date": recurring_order.recurring_scheduled_for.isoformat()
                        if recurring_order.recurring_scheduled_for
                        else "",
                    },
                    "is_read": False,
                },
            )

        self.create_order(
            order_number="ORD-PRODUCER-PURCHASE-1",
            customer_email="producer@example.com",
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.PAID,
            payment_reference="PAY-PRODUCER-PURCHASE-1",
            delivery_address="Bristol Valley Farm, Unit 5 Farm Lane, Bristol, BS1 4DJ",
            postcode="BS1 4DJ",
            special_instructions="Producer demo purchase from other network suppliers.",
            created_at=timezone.now() - timedelta(days=6),
            suborders=[
                {
                    "producer_email": "producer2@example.com",
                    "delivery_date": timezone.localdate() - timedelta(days=4),
                    "status": Order.Status.DELIVERED,
                    "subtotal": "23.09",
                    "history": [
                        (Order.Status.CONFIRMED, "Producer purchase confirmed by dairy supplier."),
                        (Order.Status.READY, "Packed chilled for collection."),
                        (Order.Status.DELIVERED, "Delivered to Bristol Valley Farm."),
                    ],
                    "items": [
                        {"product": "Fresh Milk", "quantity": "6.00", "unit_price": "1.95"},
                        {"product": "Cheddar Cheese", "quantity": "1.65", "unit_price": "6.90"},
                    ],
                }
            ],
        )

    def seed_content(self) -> None:
        def recipe(producer_email, title, description, ingredients, instructions, tag, products, image_url, ai=False):
            item, _ = Recipe.objects.update_or_create(
                producer=self.orders_producers[producer_email],
                title=title,
                defaults={
                    "description": description,
                    "ingredients": ingredients,
                    "instructions": instructions,
                    "seasonal_tag": tag,
                    "image_url": image_url,
                    "is_ai_generated": ai,
                    "is_published": True,
                },
            )
            RecipeProduct.objects.filter(recipe=item).delete()
            for product_name in products:
                RecipeProduct.objects.create(recipe=item, product=self.products[product_name])
            self.recipes[title] = item
            return item

        recipe("producer@example.com", "Roasted Root Vegetable Medley", "A seasonal tray bake using carrots, parsnips, and potatoes from Bristol Valley Farm.", "2kg carrots\n1kg parsnips\n1kg potatoes\nolive oil\nsea salt", "Chop vegetables into even pieces. Toss with oil and salt. Roast at 200C for 35 to 40 minutes until golden. Serve warm with herbs.", "Autumn/Winter", ["Organic Carrots", "Parsnips", "Potatoes"], "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900", ai=False)
        recipe("producer@example.com", "Tomato Basil Pasta", "AI-assisted weeknight pasta using Bristol tomatoes and fresh basil.", "Organic tomatoes\nBasil bunches\nPasta\nOlive oil\nGarlic", "Cook pasta until al dente. Simmer tomatoes with garlic and olive oil. Toss pasta through the sauce and finish with torn basil.", "Summer", ["Organic Tomatoes", "Basil Bunches"], "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=900", ai=True)
        recipe("producer2@example.com", "Cheddar Breakfast Bake", "A warm breakfast bake using eggs, cheddar, and milk.", "Eggs\nCheddar cheese\nFresh milk\nBread cubes", "Whisk eggs and milk, fold through bread and cheddar, then bake until set and golden.", "Year-round", ["Organic Free Range Eggs", "Cheddar Cheese", "Fresh Milk"], "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=900", ai=False)
        recipe("avon.orchards@example.com", "Apple Yogurt Pots", "AI-generated breakfast pots using apples and organic yogurt.", "Fresh apples\nOrganic Greek yogurt\nApple crisps\nHoney", "Dice apples, layer with yogurt, top with apple crisps, and chill until service.", "Autumn", ["Fresh Apples", "Organic Greek Yogurt", "Apple Crisps"], "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900", ai=True)

        story_specs = [
            ("producer@example.com", "Harvest Season Update", "This week we harvested root vegetables and prepared family produce boxes for the Bristol network. The carrots and parsnips are especially sweet after the cooler nights.", "Autumn/Winter", "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900", False),
            ("clifton.market.garden@example.com", "Preparing for Strawberry Season", "Our strawberry beds are nearly ready for early summer picking. The first reminders are live so customers know when the fruit is about to come into season.", "Spring", "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=900", True),
            ("harbour.bakery@example.com", "Morning Bake at Wapping Wharf", "The bakery team starts before sunrise so restaurants and community groups can receive bread while it is still fresh for service.", "Year-round", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900", False),
            ("avon.orchards@example.com", "Turning Surplus Fruit into Preserves", "Surplus orchard fruit becomes juice, crisps, jam, and chutney so less produce is wasted at the end of each picking week.", "Autumn", "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=900", True),
        ]
        for producer_email, title, body, tag, image, ai in story_specs:
            story, _ = FarmStory.objects.update_or_create(
                producer=self.orders_producers[producer_email],
                title=title,
                defaults={"body": body, "seasonal_tag": tag, "image_url": image, "is_ai_generated": ai, "is_published": True},
            )
            self.stories[title] = story

        for email, titles in {
            "customer@example.com": ["Roasted Root Vegetable Medley", "Tomato Basil Pasta"],
            "robert.johnson@email.com": ["Tomato Basil Pasta"],
            "restaurant@example.com": ["Cheddar Breakfast Bake"],
            "community@example.com": ["Roasted Root Vegetable Medley"],
        }.items():
            for title in titles:
                SavedRecipe.objects.get_or_create(user=self.users[email], recipe=self.recipes[title])

        GeneratedContentSuggestion.objects.all().delete()
        suggestions = [
            ("producer@example.com", "recipe", ["Organic Tomatoes", "Basil Bunches"], "AI Tomato Pasta Draft", "A tomato-led pasta recipe for quick weekday cooking.", "Organic tomatoes\nBasil\nPasta", "Cook pasta, simmer tomatoes, toss and serve.", "", "Summer", GeneratedContentSuggestion.Status.SAVED),
            ("producer@example.com", "story", ["Lettuce"], "Surplus Lettuce Note", "", "", "", "A short farm story explaining why surplus lettuce is discounted and still in perfect condition.", "Spring", GeneratedContentSuggestion.Status.USED),
            ("clifton.market.garden@example.com", "recipe", ["Strawberries"], "Strawberry Yogurt Bowl", "A summer breakfast bowl with local strawberries.", "Strawberries\nYogurt\nApple crisps", "Slice strawberries and layer with yogurt and crisps.", "", "Summer", GeneratedContentSuggestion.Status.SAVED),
        ]
        for producer_email, content_type, product_names, title, desc, ingredients, instructions, body, tag, status in suggestions:
            suggestion = GeneratedContentSuggestion.objects.create(
                producer=self.orders_producers[producer_email],
                content_type=content_type,
                prompt_context={"notes": "Seeded AI demo context", "tone": "Warm, practical", "seasonal_tag": tag},
                title=title,
                description=desc,
                ingredients=ingredients,
                instructions=instructions,
                body=body,
                seasonal_tag=tag,
                status=status,
            )
            suggestion.products.set([self.products[name] for name in product_names])

    def seed_reviews(self) -> None:
        def review(key, product_name, user_email, title, reviewer, rating, comment, status=ProductReview.ModerationStatus.PUBLISHED, anonymous=False, response=""):
            item, _ = ProductReview.objects.update_or_create(
                product=self.catalog_products[product_name],
                user=self.users[user_email],
                defaults={
                    "title": title,
                    "reviewer_name": reviewer,
                    "is_anonymous": anonymous,
                    "rating": rating,
                    "comment": comment,
                    "verified_purchase": True,
                    "moderation_status": status,
                    "moderation_reason": "Seeded moderation example" if status == ProductReview.ModerationStatus.REJECTED else "",
                    "producer_response": response,
                    "producer_response_at": timezone.now() if response else None,
                },
            )
            ProductReview.objects.filter(pk=item.pk).update(
                created_at=timezone.now() - timedelta(days=3 + (len(self.reviews) % 21))
            )
            self.reviews[key] = item
            return item

        review("tomatoes_5", "Organic Tomatoes", "customer@example.com", "Excellent quality and flavour", "Demo Customer", 5, "These tomatoes were incredibly fresh and flavourful. Perfect for our family's salads. Will definitely order again.", response="Thank you for supporting the Bristol tomato harvest.")
        review("milk_4", "Fresh Milk", "robert.johnson@email.com", "Reliable chilled delivery", "Robert Johnson", 4, "Milk arrived cold and tasted fresh. Useful for our weekly breakfast routine.")
        review("bread_pending", "Walnut Bread", "amelia.carter@example.com", "Packaging issue", "Amelia Carter", 2, "The loaf tasted good but the packaging was damaged when it arrived.", status=ProductReview.ModerationStatus.PENDING)
        review("jam_removed", "Plum Jam", "samira.patel@example.com", "Not appropriate", "Samira Patel", 1, "Removed moderation example for admin review.", status=ProductReview.ModerationStatus.REJECTED)
        review("apples_anon", "Fresh Apples", "morgan.family@example.com", "Great lunchbox fruit", "Anonymous", 5, "Crisp apples that kept well through the school week.", anonymous=True)

        review_specs = [
            ("carrots_robert", "Organic Carrots", "robert.johnson@email.com", "Sweet and clean", "Robert Johnson", 5, "The carrots roasted evenly and tasted naturally sweet."),
            ("carrots_amelia", "Organic Carrots", "amelia.carter@example.com", "Reliable weekly staple", "Amelia Carter", 4, "Good size and easy to prep for lunches."),
            ("parsnips_customer", "Parsnips", "customer@example.com", "Great for roasting", "Demo Customer", 5, "Soft inside, crisp outside, and very fresh."),
            ("parsnips_samira", "Parsnips", "samira.patel@example.com", "Nice winter flavour", "Samira Patel", 4, "Worked well in a root vegetable tray bake."),
            ("potatoes_robert", "Potatoes", "robert.johnson@email.com", "Good bulk value", "Robert Johnson", 4, "Useful for batch cooking and kept well."),
            ("potatoes_morgan", "Potatoes", "morgan.family@example.com", "Family favourite", "Morgan Family", 5, "The potatoes were clean, firm, and easy to store."),
            ("lettuce_amelia", "Lettuce", "amelia.carter@example.com", "Crisp surplus deal", "Amelia Carter", 4, "Good quality even as a surplus item."),
            ("lettuce_customer", "Lettuce", "customer@example.com", "Fresh salad heads", "Demo Customer", 5, "Crisp leaves and no waste after washing."),
            ("milk_customer", "Fresh Milk", "customer@example.com", "Very fresh", "Demo Customer", 5, "Arrived chilled and tasted excellent."),
            ("milk_amelia", "Fresh Milk", "amelia.carter@example.com", "Breakfast ready", "Amelia Carter", 4, "Good quality milk for the week."),
            ("cheddar_customer", "Cheddar Cheese", "customer@example.com", "Strong flavour", "Demo Customer", 5, "Great mature cheddar for sandwiches and cooking."),
            ("cheddar_morgan", "Cheddar Cheese", "morgan.family@example.com", "Kept well", "Morgan Family", 4, "Good texture and easy to portion."),
            ("yogurt_samira", "Organic Greek Yogurt", "samira.patel@example.com", "Thick and creamy", "Samira Patel", 5, "Worked well with fruit and granola."),
            ("eggs_customer", "Organic Free Range Eggs", "customer@example.com", "Bright yolks", "Demo Customer", 5, "Fresh eggs with bright yolks."),
            ("eggs_morgan", "Organic Free Range Eggs", "morgan.family@example.com", "Good breakfast eggs", "Morgan Family", 4, "Reliable quality across the box."),
            ("strawberries_customer", "Strawberries", "customer@example.com", "Sweet berries", "Demo Customer", 5, "The berries were ripe and fragrant."),
            ("strawberries_robert", "Strawberries", "robert.johnson@email.com", "Good summer flavour", "Robert Johnson", 4, "Tasted fresh and looked good on delivery."),
            ("spinach_amelia", "Baby Spinach", "amelia.carter@example.com", "Tender leaves", "Amelia Carter", 5, "Very tender and no bruising."),
            ("sourdough_customer", "Sourdough Loaf", "customer@example.com", "Excellent crust", "Demo Customer", 5, "The loaf had a crisp crust and open crumb."),
            ("sourdough_robert", "Sourdough Loaf", "robert.johnson@email.com", "Good toast", "Robert Johnson", 4, "Still toasted well the next day."),
            ("turnovers_samira", "Apple Turnovers", "samira.patel@example.com", "Nice pastry", "Samira Patel", 4, "Flaky pastry with a good apple filling."),
            ("fresh_apples_customer", "Fresh Apples", "customer@example.com", "Crisp and juicy", "Demo Customer", 5, "Good lunchbox apples with no bruising."),
            ("apple_juice_robert", "Apple Juice", "robert.johnson@email.com", "Bright flavour", "Robert Johnson", 5, "Fresh apple flavour and not too sweet."),
            ("plum_jam_morgan", "Plum Jam", "morgan.family@example.com", "Lovely preserve", "Morgan Family", 4, "Good balance of fruit and sweetness."),
            ("apple_crisps_customer", "Apple Crisps", "customer@example.com", "Crunchy snack", "Demo Customer", 5, "Crisp texture and easy to pack for snacks."),
            ("apple_crisps_robert", "Apple Crisps", "robert.johnson@email.com", "Good low-waste product", "Robert Johnson", 4, "Nice use of surplus fruit and stayed crunchy."),
            ("banana_bread_amelia", "Banana Bread", "amelia.carter@example.com", "Soft loaf", "Amelia Carter", 5, "Moist banana bread that sliced cleanly."),
        ]
        for args in review_specs:
            review(*args)

    def seed_favorites_notifications_and_inventory_events(self) -> None:
        for user_email in ["customer@example.com", "robert.johnson@email.com", "community@example.com", "restaurant@example.com", "chef@thecliftonkitchen.co.uk"]:
            for producer_email in ["producer@example.com", "producer2@example.com", "avon.orchards@example.com"]:
                FavoriteProducer.objects.get_or_create(user=self.users[user_email], producer=self.orders_producers[producer_email])

        for order_number in [
            "ORD-DEMO-URGENT",
            "ORD-DEMO-PENDING",
            "ORD-BULK-STMARYS",
            "ORD-RECUR-HARBOURSIDE-1",
            "ORD-PRODUCER-PURCHASE-1",
        ]:
            order = Order.objects.filter(order_number=order_number).first()
            if order:
                create_order_notifications(order)

        for order_number, user_email, category, message in [
            (
                "ORD-DEMO-0001",
                "customer@example.com",
                "order_status",
                "Order ORD-DEMO-0001 is now delivered. Your Bristol Valley Farm box has arrived.",
            ),
            (
                "ORD-DEMO-READY",
                "amelia.carter@example.com",
                "order_status",
                "Order ORD-DEMO-READY is ready for delivery. Track the same status from order history.",
            ),
            (
                "ORD-BULK-STMARYS",
                "catering@stmarys-school.org.uk",
                "order_confirmation",
                "Bulk order ORD-BULK-STMARYS is confirmed across 3 producers.",
            ),
            (
                "ORD-RECUR-HARBOURSIDE-1",
                "restaurant@example.com",
                "recurring_order",
                "Recurring order ORD-RECUR-HARBOURSIDE-1 is scheduled for Wednesday delivery.",
            ),
            (
                "ORD-PRODUCER-PURCHASE-1",
                "producer@example.com",
                "order_status",
                "Producer purchase ORD-PRODUCER-PURCHASE-1 has been delivered.",
            ),
        ]:
            order = Order.objects.filter(order_number=order_number).first()
            UserNotification.objects.get_or_create(
                user=self.users[user_email],
                category=category,
                message=message,
                defaults={
                    "metadata": {
                        "order_id": order.id if order else None,
                        "order_number": order_number,
                    },
                    "is_read": False,
                },
            )

        lettuce = self.portal_products["producer@example.com:Lettuce"]
        asparagus = self.portal_products["producer@example.com:Early Asparagus"]
        ProducerNotification.objects.get_or_create(
            producer=self.orders_producers["producer@example.com"],
            category="low_stock",
            message="Low Stock Alert: Early Asparagus - Only 6 kg remaining",
            defaults={"metadata": {"product_id": asparagus.id, "stock": 6, "threshold": 10}, "is_read": False},
        )
        ProducerNotification.objects.get_or_create(
            producer=self.orders_producers["producer@example.com"],
            category="surplus_deal",
            message="Surplus deal active: Lettuce is 30% off and should be promoted today.",
            defaults={"metadata": {"product_id": lettuce.id, "discount": 30}, "is_read": False},
        )
        ProducerNotification.objects.get_or_create(
            producer=self.orders_producers["producer@example.com"],
            category="seasonal_reminder",
            message="Early Asparagus season starts soon. Review stock, imagery, and storage guidance.",
            defaults={"metadata": {"product_id": asparagus.id, "season_start_month": 6}, "is_read": False},
        )
        eggs = self.portal_products["producer2@example.com:Organic Free Range Eggs"]
        ProducerNotification.objects.get_or_create(
            producer=self.orders_producers["producer2@example.com"],
            category="low_stock",
            message="Low Stock Alert: Organic Free Range Eggs - Only 9 dozen remaining",
            defaults={"metadata": {"product_id": eggs.id, "stock": 9, "threshold": 10}, "is_read": False},
        )
        ProducerNotification.objects.get_or_create(
            producer=self.orders_producers["producer2@example.com"],
            category="low_stock",
            message="Resolved Low Stock Alert: Organic Free Range Eggs replenished to 40 dozen",
            defaults={"metadata": {"product_id": eggs.id, "stock": 40, "threshold": 10}, "is_read": True, "resolved_at": timezone.now()},
        )
        strawberries = self.portal_products["clifton.market.garden@example.com:Strawberries"]
        ProducerNotification.objects.get_or_create(
            producer=self.orders_producers["clifton.market.garden@example.com"],
            category="seasonal_reminder",
            message="Strawberries become available soon. Review stock and listing details.",
            defaults={"metadata": {"product_id": strawberries.id, "season_start_month": 6}, "is_read": False},
        )
        for email in ["customer@example.com", "robert.johnson@email.com"]:
            UserNotification.objects.get_or_create(
                user=self.users[email],
                category="surplus_deal",
                message="Bristol Valley Farm has a surplus lettuce deal ending soon.",
                defaults={"metadata": {"product": "Lettuce", "discount": 30}, "is_read": False},
            )
        recurring_template = RecurringOrderTemplate.objects.filter(restaurant=self.users["restaurant@example.com"]).first()
        UserNotification.objects.get_or_create(
            user=self.users["restaurant@example.com"],
            category="recurring_order",
            message="Your Harbourside weekly recurring order is scheduled for Wednesday delivery.",
            defaults={
                "metadata": {
                    "frequency": "weekly",
                    "template_id": recurring_template.id if recurring_template else None,
                },
                "is_read": False,
            },
        )
        for event_type, previous, new, note in [("stock_update", 50, 9, "Simulated orders reduced stock below threshold."), ("stock_replenished", 9, 40, "Producer replenished stock after low-stock alert.")]:
            ProducerProductInventoryEvent.objects.create(
                product=eggs,
                actor=self.users["producer2@example.com"],
                event_type=event_type,
                previous_stock_quantity=previous,
                new_stock_quantity=new,
                previous_availability=ProductAvailability.YEAR_ROUND,
                new_availability=ProductAvailability.YEAR_ROUND,
                note=note,
            )

    def seed_moderation(self) -> None:
        ModerationReport.objects.all().delete()
        ModerationAction.objects.all().delete()
        admin = self.users["admin@example.com"]
        open_product = create_report(
            target_type=ModerationReport.TargetType.PRODUCT,
            object_id=self.products["Walnut Bread"].id,
            reported_by=self.users["customer@example.com"],
            reason="Allergen wording needs admin review.",
        )
        kept_review = create_report(
            target_type=ModerationReport.TargetType.REVIEW,
            object_id=self.reviews["milk_4"].id,
            reported_by=self.users["producer2@example.com"],
            reason="Producer asked admin to check this review.",
        )
        keep_reported_target(kept_review, admin_user=admin, note="Review is fair and remains live.")
        removed_review = create_report(
            target_type=ModerationReport.TargetType.REVIEW,
            object_id=self.reviews["bread_pending"].id,
            reported_by=self.users["restaurant@example.com"],
            reason="Packaging complaint requires moderation.",
        )
        remove_reported_target(removed_review, admin_user=admin, note="Removed pending review from public view for demo moderation.")
        open_recipe = create_report(
            target_type=ModerationReport.TargetType.RECIPE,
            object_id=self.recipes["Tomato Basil Pasta"].id,
            reported_by=self.users["robert.johnson@email.com"],
            reason="Check AI label and pasta instructions.",
        )
        kept_story = create_report(
            target_type=ModerationReport.TargetType.FARM_STORY,
            object_id=self.stories["Turning Surplus Fruit into Preserves"].id,
            reported_by=self.users["community@example.com"],
            reason="Story mentions surplus food waste claims.",
        )
        keep_reported_target(kept_story, admin_user=admin, note="Educational story is accurate and kept live.")
        open_customer = create_report(
            target_type=ModerationReport.TargetType.CUSTOMER_ACCOUNT,
            object_id=self.users["samira.patel@example.com"].id,
            reported_by=self.users["producer@example.com"],
            reason="Demo account report for admin customer inspection.",
        )
        removed_producer = create_report(
            target_type=ModerationReport.TargetType.PRODUCER_ACCOUNT,
            object_id=self.users["avon.orchards@example.com"].id,
            reported_by=self.users["customer@example.com"],
            reason="Demo producer account removal workflow.",
        )
        remove_reported_target(removed_producer, admin_user=admin, note="Temporarily deactivated demo producer account for moderation training.")
        # Reactivate the user after recording removed history so the demo account can still be used.
        producer_user = self.users["avon.orchards@example.com"]
        producer_user.is_active = True
        producer_user.save(update_fields=["is_active"])
        ModerationAction.objects.create(
            target_type=ModerationReport.TargetType.PRODUCER_ACCOUNT,
            content_type=ContentType.objects.get_for_model(producer_user, for_concrete_model=False),
            object_id=producer_user.id,
            target=producer_user,
            action=ModerationAction.Action.REACTIVATE,
            note="Reactivated after creating removed-case demo history so login remains available.",
            admin_user=admin,
            before_snapshot={"is_active": False},
            after_snapshot={"is_active": True},
        )
        # Keep references alive for linters/readability.
        _ = (open_product, open_recipe, open_customer)

    def print_summary(self, stdout, style) -> None:
        counts = {
            "users": self.User.objects.count(),
            "orders_producers": Producer.objects.count(),
            "producer_products": ProducerProduct.objects.count(),
            "marketplace_products": Product.objects.count(),
            "catalog_products": CatalogProduct.objects.count(),
            "orders": Order.objects.count(),
            "reviews": ProductReview.objects.count(),
            "reports": ModerationReport.objects.count(),
            "recipes": Recipe.objects.count(),
            "farm_stories": FarmStory.objects.count(),
            "settlements": WeeklySettlement.objects.count(),
        }
        stdout.write(style.WARNING("Seeded totals:"))
        stdout.write(", ".join(f"{key}={value}" for key, value in counts.items()))
        stdout.write(style.WARNING(f"Password for all accounts: {self.password}"))
        stdout.write(style.WARNING("Login accounts:"))
        for email, role, label in self.login_rows:
            stdout.write(f"- {email} | {role} | {label} | {self.password}")
