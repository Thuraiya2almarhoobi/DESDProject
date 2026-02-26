from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.content.models import FarmStory, Recipe, RecipeProduct
from apps.orders.models import CustomerProfile, Producer, Product


class Command(BaseCommand):
    help = "Seed demo users and marketplace data for orders/geo/content flows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="DemoPass123!",
            help="Password used for all seeded demo accounts.",
        )

    def handle(self, *args, **options):
        password = options["password"]
        User = get_user_model()

        def upsert_user(email: str, *, is_staff: bool = False, is_superuser: bool = False):
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    "email": email,
                    "is_staff": is_staff,
                    "is_superuser": is_superuser,
                },
            )
            user.email = email
            user.is_staff = is_staff
            user.is_superuser = is_superuser
            user.set_password(password)
            user.save(update_fields=["email", "is_staff", "is_superuser", "password"])
            return user, created

        customer_user, customer_created = upsert_user("customer@example.com")
        producer_user, producer_created = upsert_user("producer@example.com")
        producer_two_user, producer_two_created = upsert_user("producer2@example.com")
        admin_user, admin_created = upsert_user("admin@example.com", is_staff=True, is_superuser=True)

        CustomerProfile.objects.update_or_create(
            user=customer_user,
            defaults={
                "full_name": "Demo Customer",
                "phone": "07700900123",
                "delivery_address": "45 Park Street, Bristol",
                "postcode": "BS1 5JG",
            },
        )

        bristol_farm, _ = Producer.objects.update_or_create(
            business_name="Bristol Valley Farm",
            defaults={
                "user": producer_user,
                "contact_email": producer_user.email,
                "phone": "01179123456",
                "postcode": "BS1 4DJ",
                "lead_time_hours": 48,
                "is_active": True,
            },
        )

        hillside_dairy, _ = Producer.objects.update_or_create(
            business_name="Hillside Dairy",
            defaults={
                "user": producer_two_user,
                "contact_email": producer_two_user.email,
                "phone": "01179001122",
                "postcode": "BS3 2AA",
                "lead_time_hours": 72,
                "is_active": True,
            },
        )

        product_specs = [
            {
                "producer": bristol_farm,
                "name": "Organic Carrots",
                "category": "Vegetables",
                "description": "Sweet seasonal carrots harvested fresh for local delivery.",
                "unit": "kg",
                "price": Decimal("1.80"),
                "stock_quantity": Decimal("120.00"),
                "is_available": True,
                "in_season": True,
                "harvest_date": date.today(),
                "allergen_info": "",
            },
            {
                "producer": bristol_farm,
                "name": "Parsnips",
                "category": "Vegetables",
                "description": "Fresh parsnips ideal for roasting and soups.",
                "unit": "kg",
                "price": Decimal("2.10"),
                "stock_quantity": Decimal("80.00"),
                "is_available": True,
                "in_season": True,
                "harvest_date": date.today(),
                "allergen_info": "",
            },
            {
                "producer": bristol_farm,
                "name": "Potatoes",
                "category": "Vegetables",
                "description": "Locally grown potatoes suitable for bulk and household orders.",
                "unit": "kg",
                "price": Decimal("1.40"),
                "stock_quantity": Decimal("300.00"),
                "is_available": True,
                "in_season": True,
                "harvest_date": date.today(),
                "allergen_info": "",
            },
            {
                "producer": hillside_dairy,
                "name": "Fresh Milk",
                "category": "Dairy",
                "description": "Pasteurised whole milk from local grass-fed herds.",
                "unit": "litre",
                "price": Decimal("1.95"),
                "stock_quantity": Decimal("200.00"),
                "is_available": True,
                "in_season": True,
                "harvest_date": date.today(),
                "allergen_info": "Milk",
            },
            {
                "producer": hillside_dairy,
                "name": "Organic Free Range Eggs",
                "category": "Eggs",
                "description": "Free-range eggs collected daily.",
                "unit": "dozen",
                "price": Decimal("3.50"),
                "stock_quantity": Decimal("90.00"),
                "is_available": True,
                "in_season": True,
                "harvest_date": date.today(),
                "allergen_info": "Eggs",
            },
            {
                "producer": hillside_dairy,
                "name": "Walnut Bread",
                "category": "Bakery",
                "description": "Artisan bread loaf with walnuts and whole wheat flour.",
                "unit": "each",
                "price": Decimal("4.20"),
                "stock_quantity": Decimal("60.00"),
                "is_available": True,
                "in_season": True,
                "harvest_date": date.today(),
                "allergen_info": "Gluten, Nuts",
            },
        ]

        products_by_name: dict[str, Product] = {}
        for spec in product_specs:
            producer = spec["producer"]
            name = spec["name"]
            defaults = {k: v for k, v in spec.items() if k not in {"producer", "name"}}
            product, _ = Product.objects.update_or_create(
                producer=producer,
                name=name,
                defaults=defaults,
            )
            products_by_name[name] = product

        recipe, _ = Recipe.objects.update_or_create(
            producer=bristol_farm,
            title="Roasted Root Vegetable Medley",
            defaults={
                "description": "A seasonal tray bake using root vegetables from Bristol Valley Farm.",
                "ingredients": "2kg carrots\n1kg parsnips\n1kg potatoes\nolive oil\nsea salt",
                "instructions": "Chop vegetables. Toss with oil and seasoning. Roast at 200C for 35-40 minutes.",
                "seasonal_tag": "Autumn/Winter",
                "image_url": "",
                "is_published": True,
            },
        )

        RecipeProduct.objects.filter(recipe=recipe).delete()
        linked_products = [
            products_by_name.get("Organic Carrots"),
            products_by_name.get("Parsnips"),
            products_by_name.get("Potatoes"),
        ]
        RecipeProduct.objects.bulk_create(
            [
                RecipeProduct(recipe=recipe, product=product)
                for product in linked_products
                if product is not None
            ],
            ignore_conflicts=True,
        )

        FarmStory.objects.update_or_create(
            producer=bristol_farm,
            title="Harvest Season Update",
            defaults={
                "body": "This week we harvested root vegetables and prepared family produce boxes for the Bristol network.",
                "seasonal_tag": "Autumn/Winter",
                "image_url": "",
                "is_published": True,
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
        self.stdout.write(
            self.style.WARNING(
                "Accounts: customer@example.com, producer@example.com, producer2@example.com, admin@example.com"
            )
        )
        self.stdout.write(self.style.WARNING(f"Password for all accounts: {password}"))
        self.stdout.write(
            "Users created/updated: "
            f"customer={customer_created}, producer={producer_created}, "
            f"producer2={producer_two_created}, admin={admin_created}"
        )
