from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import (
    Address,
    CommunityGroupProfile,
    CustomerProfile as EditableCustomerProfile,
    ProducerProfile as EditableProducerProfile,
    RestaurantProfile,
)
from apps.content.models import FarmStory, Recipe, RecipeProduct
from apps.orders.marketplace_sync import _available_orders_business_name
from apps.orders.models import (
    CustomerProfile,
    Order,
    OrderItem,
    PaymentTransaction,
    Producer,
    ProducerSubOrder,
    Product,
)
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
        community_user, community_created = upsert_user(
            "community@example.com",
            role=User.Role.COMMUNITY,
        )
        restaurant_user, restaurant_created = upsert_user(
            "restaurant@example.com",
            role=User.Role.RESTAURANT,
        )
        admin_user, admin_created = upsert_user(
            "admin@example.com",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        finance_admin_user, finance_admin_created = upsert_user(
            "finance.admin@example.com",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        operations_admin_user, operations_admin_created = upsert_user(
            "operations.admin@example.com",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        audit_admin_user, audit_admin_created = upsert_user(
            "audit.admin@example.com",
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

        def upsert_address(user, *, label: str, line1: str, city: str, postcode: str, line2: str = "", is_default: bool = True):
            address = Address.objects.filter(user=user, label=label).order_by("id").first()
            if address is None:
                address = Address.objects.filter(user=user, is_default=True).order_by("id").first()

            if address is None:
                if is_default:
                    Address.objects.filter(user=user).update(is_default=False)
                return Address.objects.create(
                    user=user,
                    label=label,
                    line1=line1,
                    line2=line2,
                    city=city,
                    postcode=postcode,
                    is_default=is_default,
                )

            address.label = label
            address.line1 = line1
            address.line2 = line2
            address.city = city
            address.postcode = postcode
            if is_default:
                Address.objects.filter(user=user).exclude(pk=address.pk).update(is_default=False)
            address.is_default = is_default
            address.save(update_fields=["label", "line1", "line2", "city", "postcode", "is_default"])
            return address

        customer_address = upsert_address(
            customer_user,
            label="Delivery Address",
            line1="45 Park Street",
            city="Bristol",
            postcode="BS1 5JG",
        )
        EditableCustomerProfile.objects.update_or_create(
            user=customer_user,
            defaults={
                "full_name": "Demo Customer",
                "phone": "07700900123",
                "allergies_text": "",
                "preferences_text": "",
                "default_address": customer_address,
            },
        )

        def upsert_orders_producer(*, user, business_name: str, phone: str, postcode: str, lead_time_hours: int) -> Producer:
            producer = Producer.objects.filter(user=user).first()
            if producer is None:
                producer = Producer.objects.filter(business_name=business_name).first()

            desired_business_name = _available_orders_business_name(
                business_name,
                user=user,
                exclude_pk=producer.pk if producer else None,
            )
            defaults = {
                "user": user,
                "business_name": desired_business_name,
                "contact_email": user.email,
                "phone": phone,
                "postcode": postcode,
                "lead_time_hours": lead_time_hours,
                "is_active": True,
            }

            if producer is None:
                return Producer.objects.create(**defaults)

            updated_fields: list[str] = []
            for field_name, value in defaults.items():
                if getattr(producer, field_name) != value:
                    setattr(producer, field_name, value)
                    updated_fields.append(field_name)

            if updated_fields:
                producer.save(update_fields=[*updated_fields, "updated_at"])
            return producer

        bristol_farm = upsert_orders_producer(
            user=producer_user,
            business_name="Bristol Valley Farm",
            phone="01179123456",
            postcode="BS1 4DJ",
            lead_time_hours=48,
        )
        bristol_farm_address = upsert_address(
            producer_user,
            label="Business Address",
            line1="Unit 5 Farm Lane",
            city="Bristol",
            postcode="BS1 4DJ",
        )
        EditableProducerProfile.objects.update_or_create(
            user=producer_user,
            defaults={
                "business_name": "Bristol Valley Farm",
                "contact_name": "Amelia Grower",
                "phone": "01179123456",
                "farm_origin_text": "Fresh seasonal produce from Bristol growers.",
                "lead_time_hours": 48,
                "address": bristol_farm_address,
            },
        )

        hillside_dairy = upsert_orders_producer(
            user=producer_two_user,
            business_name="Hillside Dairy",
            phone="01179001122",
            postcode="BS3 2AA",
            lead_time_hours=72,
        )
        hillside_dairy_address = upsert_address(
            producer_two_user,
            label="Business Address",
            line1="18 Dairy Lane",
            city="Bristol",
            postcode="BS3 2AA",
        )
        EditableProducerProfile.objects.update_or_create(
            user=producer_two_user,
            defaults={
                "business_name": "Hillside Dairy",
                "contact_name": "Harvey Milker",
                "phone": "01179001122",
                "farm_origin_text": "Milk, eggs, and bakery goods prepared for local delivery.",
                "lead_time_hours": 72,
                "address": hillside_dairy_address,
            },
        )

        community_address = upsert_address(
            community_user,
            label="Delivery Address",
            line1="18 Park Row",
            city="Bristol",
            postcode="BS1 5LJ",
        )
        CommunityGroupProfile.objects.update_or_create(
            user=community_user,
            defaults={
                "organisation_name": "Community Pantry",
                "org_type": "Community Group",
                "contact_name": "Nadia Organiser",
                "phone": "07700900124",
                "delivery_address": community_address,
            },
        )

        restaurant_address = upsert_address(
            restaurant_user,
            label="Delivery Address",
            line1="14 Harbourside",
            city="Bristol",
            postcode="BS1 5UH",
        )
        RestaurantProfile.objects.update_or_create(
            user=restaurant_user,
            defaults={
                "business_name": "Harbourside Restaurant",
                "contact_name": "Marco Chef",
                "phone": "07700900125",
                "delivery_address": restaurant_address,
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
                producer_user,
                {
                    "name": "Potatoes",
                    "category": "Vegetables",
                    "description": "Locally grown potatoes suitable for bulk and household orders.",
                    "price": Decimal("1.40"),
                    "unit": "kg",
                    "availability": ProductAvailability.YEAR_ROUND,
                    "stock_quantity": 300,
                    "allergen_information": "",
                    "harvest_date": date.today(),
                    "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800",
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
                    "category": "Eggs",
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
            (
                producer_two_user,
                {
                    "name": "Walnut Bread",
                    "category": "Bakery",
                    "description": "Artisan bread loaf with walnuts and whole wheat flour.",
                    "price": Decimal("4.20"),
                    "unit": "each",
                    "availability": ProductAvailability.YEAR_ROUND,
                    "stock_quantity": 60,
                    "allergen_information": "Gluten, Nuts",
                    "harvest_date": date.today(),
                    "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
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

        def upsert_commission_report_order(
            *,
            order_number: str,
            created_at,
            delivery_address: str,
            postcode: str,
            total_amount: Decimal,
            commission_amount: Decimal,
            producer_payout_total: Decimal,
            payment_reference: str,
            sub_order_specs: list[dict],
        ):
            order, _ = Order.objects.update_or_create(
                order_number=order_number,
                defaults={
                    "customer": customer_user,
                    "status": Order.Status.DELIVERED,
                    "payment_status": Order.PaymentStatus.PAID,
                    "delivery_address": delivery_address,
                    "customer_postcode": postcode,
                    "special_instructions": "Admin reporting reference order",
                    "subtotal_amount": total_amount,
                    "commission_rate": Decimal("0.05"),
                    "commission_amount": commission_amount,
                    "total_amount": total_amount,
                    "producer_payout_total": producer_payout_total,
                    "payment_method": "test_card",
                    "payment_reference": payment_reference,
                },
            )

            ProducerSubOrder.objects.filter(order=order).delete()
            OrderItem.objects.filter(order=order).delete()

            for spec in sub_order_specs:
                sub_order = ProducerSubOrder.objects.create(
                    order=order,
                    producer=spec["producer"],
                    status=Order.Status.DELIVERED,
                    delivery_date=created_at.date() + timedelta(days=2),
                    subtotal_amount=spec["subtotal_amount"],
                    commission_amount=spec["commission_amount"],
                    payout_amount=spec["payout_amount"],
                    notes="Seeded commission reporting data",
                )
                OrderItem.objects.create(
                    order=order,
                    sub_order=sub_order,
                    product=spec["product"],
                    product_name=spec["product_name"],
                    producer_name=spec["producer"].business_name,
                    unit=spec.get("unit", "kg"),
                    quantity=spec["quantity"],
                    unit_price=spec["unit_price"],
                    line_total=spec["line_total"],
                )

            payment, _ = PaymentTransaction.objects.update_or_create(
                order=order,
                defaults={
                    "provider": "mock",
                    "provider_reference": payment_reference,
                    "amount": total_amount,
                    "currency": "GBP",
                    "status": "succeeded",
                    "test_mode": True,
                    "raw_payload": {"seeded": True, "source": "seed_demo_data"},
                },
            )
            Order.objects.filter(id=order.id).update(created_at=created_at, updated_at=created_at)
            PaymentTransaction.objects.filter(id=payment.id).update(created_at=created_at + timedelta(minutes=5))

        commission_now = timezone.now()
        upsert_commission_report_order(
            order_number="ORD-COMM-100",
            created_at=commission_now - timedelta(days=10),
            delivery_address="1 Report Street, Bristol",
            postcode="BS1 2AA",
            total_amount=Decimal("100.00"),
            commission_amount=Decimal("5.00"),
            producer_payout_total=Decimal("95.00"),
            payment_reference="PAY-REF-100",
            sub_order_specs=[
                {
                    "producer": bristol_farm,
                    "product": products_by_name["Organic Carrots"],
                    "product_name": "Organic Carrots",
                    "subtotal_amount": Decimal("100.00"),
                    "commission_amount": Decimal("5.00"),
                    "payout_amount": Decimal("95.00"),
                    "quantity": Decimal("100.00"),
                    "unit_price": Decimal("1.00"),
                    "line_total": Decimal("100.00"),
                    "unit": "kg",
                }
            ],
        )
        upsert_commission_report_order(
            order_number="ORD-COMM-150",
            created_at=commission_now - timedelta(days=3),
            delivery_address="2 Report Street, Bristol",
            postcode="BS1 2AA",
            total_amount=Decimal("150.00"),
            commission_amount=Decimal("7.50"),
            producer_payout_total=Decimal("142.50"),
            payment_reference="PAY-REF-150",
            sub_order_specs=[
                {
                    "producer": bristol_farm,
                    "product": products_by_name["Organic Carrots"],
                    "product_name": "Organic Carrots",
                    "subtotal_amount": Decimal("80.00"),
                    "commission_amount": Decimal("4.00"),
                    "payout_amount": Decimal("76.00"),
                    "quantity": Decimal("80.00"),
                    "unit_price": Decimal("1.00"),
                    "line_total": Decimal("80.00"),
                    "unit": "kg",
                },
                {
                    "producer": hillside_dairy,
                    "product": products_by_name["Fresh Milk"],
                    "product_name": "Fresh Milk",
                    "subtotal_amount": Decimal("70.00"),
                    "commission_amount": Decimal("3.50"),
                    "payout_amount": Decimal("66.50"),
                    "quantity": Decimal("70.00"),
                    "unit_price": Decimal("1.00"),
                    "line_total": Decimal("70.00"),
                    "unit": "litre",
                },
            ],
        )

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
                "Accounts: customer@example.com, producer@example.com, producer2@example.com, "
                "community@example.com, restaurant@example.com, admin@example.com, "
                "finance.admin@example.com, operations.admin@example.com, audit.admin@example.com"
            )
        )
        self.stdout.write(self.style.WARNING(f"Password for all accounts: {password}"))
        self.stdout.write(
            "Users created/updated: "
            f"customer={customer_created}, producer={producer_created}, "
            f"producer2={producer_two_created}, community={community_created}, restaurant={restaurant_created}, admin={admin_created}, "
            f"finance_admin={finance_admin_created}, operations_admin={operations_admin_created}, "
            f"audit_admin={audit_admin_created}"
        )
