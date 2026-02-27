from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.content.models import FarmStory, Recipe, RecipeProduct
from apps.orders.models import CustomerProfile, Producer, Product
from apps.payments.services import get_previous_week_range, process_weekly_settlements
from apps.producer_portal.models import (
    OrderStatus,
    ProducerOrder,
    ProducerOrderItem,
    ProducerProduct,
    ProductAvailability,
)


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

        def upsert_user(
            email: str,
            *,
            role: str,
            is_staff: bool = False,
            is_superuser: bool = False,
        ):
            user = User.objects.filter(email__iexact=email).first()
            created = user is None
            if user is None:
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    role=role,
                    is_staff=is_staff,
                    is_superuser=is_superuser,
                )

            user.email = email
            user.role = role
            user.is_staff = is_staff
            user.is_superuser = is_superuser
            user.set_password(password)
            user.save(update_fields=["email", "role", "is_staff", "is_superuser", "password"])
            return user, created

        customer_user, customer_created = upsert_user(
            "customer@example.com",
            role=User.Role.CUSTOMER,
        )
        producer_user, producer_created = upsert_user(
            "producer@example.com",
            role=User.Role.PRODUCER,
        )
        producer_two_user, producer_two_created = upsert_user(
            "producer2@example.com",
            role=User.Role.PRODUCER,
        )
        admin_user, admin_created = upsert_user(
            "admin@example.com",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )

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

        # Producer-portal product catalogue used by producer inventory screens (TC-003).
        producer_portal_products = [
            (
                producer_user,
                {
                    "name": "Organic Carrots",
                    "category": "Vegetables",
                    "description": "Sweet seasonal carrots harvested fresh for local delivery.",
                    "price": Decimal("1.80"),
                    "unit": "kg",
                    "availability": ProductAvailability.IN_SEASON,
                    "stock_quantity": 120,
                    "allergen_information": "",
                    "harvest_date": date.today(),
                    "image_url": "https://images.unsplash.com/photo-1447175008436-054170c2e979?w=800",
                },
            ),
            (
                producer_user,
                {
                    "name": "Parsnips",
                    "category": "Vegetables",
                    "description": "Fresh parsnips ideal for roasting and soups.",
                    "price": Decimal("2.10"),
                    "unit": "kg",
                    "availability": ProductAvailability.IN_SEASON,
                    "stock_quantity": 80,
                    "allergen_information": "",
                    "harvest_date": date.today(),
                    "image_url": "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=800",
                },
            ),
            (
                producer_two_user,
                {
                    "name": "Fresh Milk",
                    "category": "Dairy",
                    "description": "Pasteurised whole milk from local grass-fed herds.",
                    "price": Decimal("1.95"),
                    "unit": "litre",
                    "availability": ProductAvailability.YEAR_ROUND,
                    "stock_quantity": 200,
                    "allergen_information": "Milk",
                    "harvest_date": date.today(),
                    "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800",
                },
            ),
            (
                producer_two_user,
                {
                    "name": "Organic Free Range Eggs",
                    "category": "Dairy & Eggs",
                    "description": "Free-range eggs collected daily.",
                    "price": Decimal("3.50"),
                    "unit": "dozen",
                    "availability": ProductAvailability.YEAR_ROUND,
                    "stock_quantity": 90,
                    "allergen_information": "Eggs",
                    "harvest_date": date.today(),
                    "image_url": "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=800",
                },
            ),
        ]
        producer_products_by_name: dict[str, ProducerProduct] = {}
        for producer_user_obj, defaults in producer_portal_products:
            product, _ = ProducerProduct.objects.update_or_create(
                producer=producer_user_obj,
                name=defaults["name"],
                defaults=defaults,
            )
            producer_products_by_name[f"{producer_user_obj.email}:{product.name}"] = product

        def upsert_portal_order(
            *,
            order_number: str,
            producer_user_obj,
            customer_name: str,
            customer_email: str,
            delivery_address: str,
            delivery_dt,
            status_value: str,
            item_rows: list[tuple[str, Decimal]],
        ) -> ProducerOrder:
            order_date = delivery_dt - timedelta(hours=72)
            total_value = Decimal("0.00")
            for product_key, quantity in item_rows:
                product = producer_products_by_name[product_key]
                total_value += product.price * quantity

            order, _ = ProducerOrder.objects.update_or_create(
                order_number=order_number,
                defaults={
                    "producer": producer_user_obj,
                    "customer_name": customer_name,
                    "customer_email": customer_email,
                    "customer_phone": "07700900123",
                    "delivery_address": delivery_address,
                    "order_date": order_date,
                    "delivery_date": delivery_dt,
                    "status": status_value,
                    "total_value": total_value.quantize(Decimal("0.01")),
                    "special_instructions": "Leave at side door",
                    "settlement_processed": False,
                },
            )
            ProducerOrderItem.objects.filter(order=order).delete()
            for product_key, quantity in item_rows:
                product = producer_products_by_name[product_key]
                ProducerOrderItem.objects.create(
                    order=order,
                    product=product,
                    product_name=product.name,
                    quantity=quantity,
                    unit_price=product.price,
                )
            return order

        now = timezone.now()
        upsert_portal_order(
            order_number="ORD-DEMO-1001",
            producer_user_obj=producer_user,
            customer_name="North Bristol Cafe",
            customer_email="orders@northbristolcafe.com",
            delivery_address="10 Cabot Circus, Bristol, BS1 3BX",
            delivery_dt=now + timedelta(days=3),
            status_value=OrderStatus.PENDING,
            item_rows=[(f"{producer_user.email}:Organic Carrots", Decimal("20.00"))],
        )
        upsert_portal_order(
            order_number="ORD-DEMO-1002",
            producer_user_obj=producer_user,
            customer_name="Harbourside Restaurant",
            customer_email="chef@harbourside.example",
            delivery_address="14 Harbourside, Bristol, BS1 5UH",
            delivery_dt=now + timedelta(days=4),
            status_value=OrderStatus.CONFIRMED,
            item_rows=[(f"{producer_user.email}:Parsnips", Decimal("12.00"))],
        )
        upsert_portal_order(
            order_number="ORD-DEMO-1003",
            producer_user_obj=producer_two_user,
            customer_name="City Grocers",
            customer_email="stock@citygrocers.example",
            delivery_address="50 Gloucester Rd, Bristol, BS7 8BH",
            delivery_dt=now + timedelta(days=5),
            status_value=OrderStatus.PREPARING,
            item_rows=[(f"{producer_two_user.email}:Fresh Milk", Decimal("25.00"))],
        )

        # Settlement-ready delivered orders in the previous week (TC-012).
        week_range = get_previous_week_range(timezone.localdate())
        delivered_a = timezone.make_aware(datetime.combine(week_range.start + timedelta(days=2), time(9, 0)))
        delivered_b = timezone.make_aware(datetime.combine(week_range.start + timedelta(days=4), time(11, 0)))
        upsert_portal_order(
            order_number="ORD-SET-DEMO-2001",
            producer_user_obj=producer_user,
            customer_name="Community Pantry",
            customer_email="buyer@communitypantry.example",
            delivery_address="18 Park Row, Bristol, BS1 5LJ",
            delivery_dt=delivered_a,
            status_value=OrderStatus.DELIVERED,
            item_rows=[(f"{producer_user.email}:Organic Carrots", Decimal("30.00"))],
        )
        upsert_portal_order(
            order_number="ORD-SET-DEMO-2002",
            producer_user_obj=producer_user,
            customer_name="Fresh Start Kitchen",
            customer_email="orders@freshstart.example",
            delivery_address="4 Queen Square, Bristol, BS1 4JQ",
            delivery_dt=delivered_b,
            status_value=OrderStatus.DELIVERED,
            item_rows=[(f"{producer_user.email}:Parsnips", Decimal("15.00"))],
        )
        process_weekly_settlements(reference_date=timezone.localdate())

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
