"""
DESD Marketplace documentation.

File role:
    Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils.text import slugify
from django.utils import timezone

from apps.orders.models import Product
from bristol_marketplace.seasonality import format_month_range

PRODUCT_IMAGE_LIBRARY = [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900",
    "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=900",
    "https://images.unsplash.com/photo-1471194402529-8e0f5a675de6?w=900",
    "https://images.unsplash.com/photo-1506617420156-8e4536971650?w=900",
    "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=900",
    "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=900",
    "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=900",
    "https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=900",
]


def default_marketplace_image_url(product_id: int) -> str:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `default_marketplace_image_url` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    # modulo keeps fallback images deterministic without storing extra state
    return PRODUCT_IMAGE_LIBRARY[product_id % len(PRODUCT_IMAGE_LIBRARY)]


def product_is_organic(*, name: str, description: str) -> bool:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `product_is_organic` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    haystack = f"{name} {description}".lower()
    # demo products infer organic from text when no explicit flag is present
    return "organic" in haystack


def matching_producer_portal_product(order_product: Product):
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `matching_producer_portal_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.producer_portal.models import ProducerProduct

    producer_user = getattr(order_product.producer, "user", None)
    if producer_user is None:
        return None

    # unit match is preferred so eggs dozen and each do not collide
    producer_product = (
        ProducerProduct.objects.select_related("producer")
        .filter(
            producer=producer_user,
            name=order_product.name,
            unit=order_product.unit,
        )
        .order_by("-updated_at", "-id")
        .first()
    )
    if producer_product is not None:
        return producer_product

    # old synced records may only match by name so keep a fallback path
    return (
        ProducerProduct.objects.select_related("producer")
        .filter(
            producer=producer_user,
            name=order_product.name,
        )
        .order_by("-updated_at", "-id")
        .first()
    )


def _default_business_name_for_user(user) -> str:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `_default_business_name_for_user` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    profile = getattr(user, "producer_profile", None)
    if profile and profile.business_name:
        # real producer profile name should win over email derived fallback
        return profile.business_name

    local_part = (user.email or "producer").split("@")[0]
    words = [token for token in local_part.replace(".", " ").replace("_", " ").replace("-", " ").split() if token]
    if words:
        return " ".join(word.capitalize() for word in words) + " Farm"
    return f"Producer {user.pk} Farm"


def _available_orders_business_name(base_name: str, *, user=None, exclude_pk: int | None = None) -> str:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `_available_orders_business_name` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.orders.models import Producer as OrdersProducer

    business_name = base_name
    suffix = 2
    queryset = OrdersProducer.objects.all()
    if user is not None:
        queryset = queryset.exclude(user=user)
    if exclude_pk is not None:
        queryset = queryset.exclude(pk=exclude_pk)

    while queryset.filter(business_name=business_name).exists():
        # marketplace producer names must be unique for clean producer pages
        business_name = f"{base_name} {suffix}"
        suffix += 1
    return business_name


def _orders_producer_for_user(user):
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `_orders_producer_for_user` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.orders.models import Producer as OrdersProducer

    orders_producer = OrdersProducer.objects.filter(user=user).first()
    if orders_producer is not None:
        # keep order side producer profile aligned with account profile edits
        updated_fields: list[str] = []
        profile = getattr(user, "producer_profile", None)
        address = getattr(profile, "address", None)
        desired_business_name = profile.business_name if profile and profile.business_name else orders_producer.business_name
        business_name = _available_orders_business_name(
            desired_business_name,
            user=user,
            exclude_pk=orders_producer.pk,
        )
        postcode = address.postcode if address and address.postcode else orders_producer.postcode or "BS1 1AA"
        lead_time_hours = profile.lead_time_hours if profile else orders_producer.lead_time_hours

        if orders_producer.business_name != business_name:
            orders_producer.business_name = business_name
            updated_fields.append("business_name")
        if orders_producer.contact_email != (user.email or ""):
            orders_producer.contact_email = user.email or ""
            updated_fields.append("contact_email")
        if orders_producer.postcode != postcode:
            orders_producer.postcode = postcode
            updated_fields.append("postcode")
        if orders_producer.lead_time_hours != lead_time_hours:
            orders_producer.lead_time_hours = lead_time_hours
            updated_fields.append("lead_time_hours")
        if not orders_producer.is_active:
            orders_producer.is_active = True
            updated_fields.append("is_active")

        if updated_fields:
            orders_producer.save(update_fields=[*updated_fields, "updated_at"])
        return orders_producer

    profile = getattr(user, "producer_profile", None)
    address = getattr(profile, "address", None)
    base_name = _default_business_name_for_user(user)
    business_name = _available_orders_business_name(base_name, user=user)

    return OrdersProducer.objects.create(
        user=user,
        business_name=business_name,
        contact_email=user.email or "",
        postcode=address.postcode if address and address.postcode else "BS1 1AA",
        lead_time_hours=profile.lead_time_hours if profile else 48,
        is_active=True,
    )


def _catalog_product_defaults(order_product: Product) -> dict:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `_catalog_product_defaults` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    producer_product = matching_producer_portal_product(order_product)
    producer = order_product.producer
    producer_user = getattr(producer, "user", None)
    producer_profile = getattr(producer_user, "producer_profile", None) if producer_user else None
    address = getattr(producer_profile, "address", None) if producer_profile else None
    producer_location = ""
    if address and address.city:
        producer_location = f"{address.city}, UK"
    elif producer.postcode:
        producer_location = producer.postcode
    else:
        producer_location = "Bristol, UK"

    category_name = (order_product.category or "Uncategorised").strip() or "Uncategorised"

    allergen_list = [
        token.strip()
        for token in (order_product.allergen_info or "").split(",")
        if token.strip()
    ]
    is_available = bool(order_product.is_available and order_product.stock_quantity > Decimal("0.00"))

    return {
        "producer_name": producer.business_name,
        "producer_defaults": {
            "location": producer_location,
            "description": getattr(producer_profile, "farm_origin_text", "") or order_product.description,
            "delivery_lead_time": producer.lead_time_hours,
            "postcode": producer.postcode,
        },
        "category_name": category_name,
        "allergens": allergen_list,
        "image_url": producer_product.image_url if producer_product and producer_product.image_url else default_marketplace_image_url(order_product.id),
        "is_organic": getattr(producer_product, "is_organic", None) if producer_product else None,
        "organic_certification": getattr(producer_product, "organic_certification", "") if producer_product else "",
        "is_surplus": bool(getattr(producer_product, "is_surplus", False)),
        "surplus_discount": getattr(producer_product, "surplus_discount_percent", None),
        "surplus_expires_at": getattr(producer_product, "surplus_expires_at", None) if producer_product else None,
        "surplus_best_before": getattr(producer_product, "surplus_best_before", "") if producer_product else "",
        "surplus_note": getattr(producer_product, "surplus_note", "") if producer_product else "",
        "storage_tips": getattr(producer_product, "storage_tips", "") if producer_product else "",
        "availability": is_available,
    }


def _merge_catalog_product_reviews(*, canonical_product, duplicate_products) -> None:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `_merge_catalog_product_reviews` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.community.models import ProductReview

    for duplicate_product in duplicate_products:
        duplicate_reviews = ProductReview.objects.filter(product=duplicate_product).order_by("-created_at", "-id")
        for duplicate_review in duplicate_reviews:
            if duplicate_review.user_id is not None:
                canonical_review = ProductReview.objects.filter(
                    product=canonical_product,
                    user_id=duplicate_review.user_id,
                ).first()
                if canonical_review is not None:
                    if duplicate_review.created_at > canonical_review.created_at:
                        canonical_review.title = duplicate_review.title
                        canonical_review.reviewer_name = duplicate_review.reviewer_name
                        canonical_review.is_anonymous = duplicate_review.is_anonymous
                        canonical_review.rating = duplicate_review.rating
                        canonical_review.comment = duplicate_review.comment
                        canonical_review.verified_purchase = duplicate_review.verified_purchase
                        canonical_review.moderation_status = duplicate_review.moderation_status
                        canonical_review.moderation_reason = duplicate_review.moderation_reason
                        canonical_review.producer_response = duplicate_review.producer_response
                        canonical_review.producer_response_at = duplicate_review.producer_response_at
                        canonical_review.created_at = duplicate_review.created_at
                        canonical_review.save(
                            update_fields=[
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
                        )
                    duplicate_review.delete()
                    continue

            duplicate_review.product = canonical_product
            duplicate_review.save(update_fields=["product"])


def _upsert_catalog_product(*, catalog_product_model, lookup: dict, defaults: dict):
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `_upsert_catalog_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    matching_products = list(
        catalog_product_model.objects.filter(**lookup).order_by("-updated_at", "-id")
    )
    if not matching_products:
        create_values = {**defaults, **lookup}
        return catalog_product_model.objects.create(**create_values), True

    canonical_product = matching_products[0]
    duplicate_products = matching_products[1:]
    if duplicate_products:
        _merge_catalog_product_reviews(
            canonical_product=canonical_product,
            duplicate_products=duplicate_products,
        )
        catalog_product_model.objects.filter(id__in=[product.id for product in duplicate_products]).delete()

    for field_name, value in defaults.items():
        setattr(canonical_product, field_name, value)
    canonical_product.save()
    return canonical_product, False


def get_or_create_catalog_product_mirror(order_product: Product):
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `get_or_create_catalog_product_mirror` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.catalog.models import Category, Producer as CatalogProducer, Product as CatalogProduct

    payload = _catalog_product_defaults(order_product)
    catalog_producer, _ = CatalogProducer.objects.update_or_create(
        name=payload["producer_name"],
        defaults=payload["producer_defaults"],
    )

    category_name = payload["category_name"]
    category = Category.objects.filter(name=category_name).first()
    if category is None:
        base_slug = slugify(category_name) or "uncategorised"
        category_slug = base_slug
        suffix = 2
        while Category.objects.filter(slug=category_slug).exclude(name=category_name).exists():
            category_slug = f"{base_slug}-{suffix}"
            suffix += 1
        category, _ = Category.objects.update_or_create(
            slug=category_slug,
            defaults={"name": category_name},
        )

    if not order_product.is_available or order_product.stock_quantity <= Decimal("0.00"):
        availability = CatalogProduct.Availability.UNAVAILABLE
    elif order_product.season_start_month and order_product.season_end_month:
        availability = CatalogProduct.Availability.IN_SEASON
    elif order_product.in_season:
        availability = CatalogProduct.Availability.IN_SEASON
    else:
        availability = CatalogProduct.Availability.YEAR_ROUND

    seasonal_dates = format_month_range(order_product.season_start_month, order_product.season_end_month)

    defaults = {
        "category": category,
        "description": order_product.description,
        "price": order_product.price,
        "unit": order_product.unit,
        "harvest_date": order_product.harvest_date or timezone.localdate(),
        "availability": availability,
        "seasonal_dates": seasonal_dates or ("Current season" if order_product.in_season else ""),
        "is_organic": payload["is_organic"] if payload["is_organic"] is not None else product_is_organic(name=order_product.name, description=order_product.description),
        "organic_certification": payload["organic_certification"],
        "allergens": payload["allergens"],
        "image_url": payload["image_url"],
        "stock": int(order_product.stock_quantity),
        "food_miles": 0,
        "is_surplus": payload["is_surplus"],
        "surplus_discount": payload["surplus_discount"],
        "surplus_original_price": None,
        "surplus_expires_at": payload["surplus_expires_at"],
        "surplus_best_before": payload["surplus_best_before"] or payload["surplus_note"],
        "storage_tips": payload["storage_tips"],
        "recipe_ideas": list(
            order_product.product_recipes.select_related("recipe")
            .order_by("recipe__title")
            .values_list("recipe__title", flat=True)
        ),
    }
    if defaults["is_surplus"] and defaults["surplus_discount"]:
        discount = Decimal(str(defaults["surplus_discount"]))
        if discount < 100:
            defaults["surplus_original_price"] = (
                order_product.price / (Decimal("1.00") - (discount / Decimal("100.00")))
            ).quantize(Decimal("0.01"))

    with transaction.atomic():
        catalog_product, _ = _upsert_catalog_product(
            catalog_product_model=CatalogProduct,
            lookup={
                "producer": catalog_producer,
                "name": order_product.name,
                "unit": order_product.unit,
            },
            defaults=defaults,
        )
    return catalog_product


def sync_catalog_product_from_orders_product(order_product: Product) -> None:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `sync_catalog_product_from_orders_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    get_or_create_catalog_product_mirror(order_product)


def delete_catalog_product_for_orders_product(order_product: Product) -> None:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `delete_catalog_product_for_orders_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.catalog.models import Product as CatalogProduct

    CatalogProduct.objects.filter(
        producer__name=order_product.producer.business_name,
        name=order_product.name,
        unit=order_product.unit,
    ).delete()


def sync_orders_product_from_producer_product(producer_product):
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `sync_orders_product_from_producer_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.orders.models import Product as OrdersProduct
    from apps.producer_portal.models import ProductAvailability

    owner = producer_product.producer
    orders_producer = _orders_producer_for_user(owner)
    is_available = (
        producer_product.availability in {ProductAvailability.IN_SEASON, ProductAvailability.YEAR_ROUND}
        and producer_product.stock_quantity > 0
    )
    order_product, _ = OrdersProduct.objects.update_or_create(
        producer=orders_producer,
        name=producer_product.name,
        unit=producer_product.unit,
        defaults={
            "category": producer_product.category,
            "description": producer_product.description,
            "price": producer_product.price,
            "stock_quantity": producer_product.stock_quantity,
            "is_available": is_available,
            "in_season": producer_product.availability == ProductAvailability.IN_SEASON,
            "season_start_month": producer_product.season_start_month,
            "season_end_month": producer_product.season_end_month,
            "harvest_date": producer_product.harvest_date,
            "allergen_info": producer_product.allergen_information,
        },
    )
    sync_catalog_product_from_orders_product(order_product)
    return order_product


def delete_orders_and_catalog_products_for_producer_product(producer_product) -> None:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `delete_orders_and_catalog_products_for_producer_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.orders.models import Product as OrdersProduct

    orders_product = (
        OrdersProduct.objects.filter(
            producer__user=producer_product.producer,
            name=producer_product.name,
            unit=producer_product.unit,
        )
        .order_by("-updated_at", "-id")
        .first()
    )
    if orders_product is not None:
        delete_catalog_product_for_orders_product(orders_product)
        orders_product.delete()


def delete_orders_and_catalog_products_for_name(*, producer_user, product_name: str) -> None:
    """
    Helper for the file role: Keeps catalog and order-facing product state aligned for marketplace display and checkout operations.

    `delete_orders_and_catalog_products_for_name` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    """
    from apps.orders.models import Product as OrdersProduct

    orders_products = OrdersProduct.objects.filter(
        producer__user=producer_user,
        name=product_name,
    )
    for orders_product in orders_products:
        delete_catalog_product_for_orders_product(orders_product)
    orders_products.delete()
