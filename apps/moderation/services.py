from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.catalog.models import Product as CatalogProduct
from apps.community.models import ProductReview
from apps.content.models import FarmStory, Recipe
from apps.orders.models import Producer as OrderProducer
from apps.orders.models import Product as OrderProduct
from apps.orders.marketplace_sync import get_or_create_catalog_product_mirror

from .models import ModerationAction, ModerationReport

User = get_user_model()


TARGET_MODEL_MAP = {
    ModerationReport.TargetType.CUSTOMER_ACCOUNT: User,
    ModerationReport.TargetType.PRODUCER_ACCOUNT: User,
    ModerationReport.TargetType.PRODUCT: OrderProduct,
    ModerationReport.TargetType.REVIEW: ProductReview,
    ModerationReport.TargetType.RECIPE: Recipe,
    ModerationReport.TargetType.FARM_STORY: FarmStory,
}

ACCOUNT_ROLES = [User.Role.CUSTOMER, User.Role.COMMUNITY, User.Role.RESTAURANT]


def _user_profile_name(user: User) -> str:
    profile_attr = {
        User.Role.CUSTOMER: "customer_profile",
        User.Role.COMMUNITY: "community_profile",
        User.Role.RESTAURANT: "restaurant_profile",
        User.Role.PRODUCER: "producer_profile",
    }.get(user.role)
    profile = getattr(user, profile_attr, None) if profile_attr else None
    if profile is None:
        return user.email
    for field in ("full_name", "contact_name", "business_name", "organisation_name"):
        value = getattr(profile, field, "")
        if value:
            return value
    return user.email


def _producer_for_user(user: User) -> OrderProducer | None:
    return OrderProducer.objects.filter(user=user).first()


def _public_product_url(target: Any) -> str:
    product_name = getattr(target, "name", "")
    order_product = target if isinstance(target, OrderProduct) else None

    if isinstance(target, CatalogProduct):
        order_product = (
            OrderProduct.objects.filter(
                producer__business_name=target.producer.name,
                name=target.name,
                unit=target.unit,
            )
            .order_by("-updated_at", "-id")
            .first()
        )

    if order_product is not None:
        query = urlencode({"adminPreview": "1", "returnTo": "/admin/moderation"})
        return f"/admin/product-preview/{order_product.id}?{query}"

    public_product_id = getattr(target, "id", None)
    if not public_product_id:
        return "/browse"
    query = urlencode({"focusProduct": public_product_id, "q": product_name or ""})
    return f"/browse?{query}"


def _admin_preview_query(**extra: Any) -> str:
    query = {"adminPreview": "1", "returnTo": "/admin/moderation"}
    query.update({key: value for key, value in extra.items() if value not in (None, "")})
    return urlencode(query)


def _public_url_for_target(target_type: str, target: Any) -> str:
    if target_type == ModerationReport.TargetType.PRODUCT:
        return _public_product_url(target)
    if target_type == ModerationReport.TargetType.PRODUCER_ACCOUNT:
        producer = _producer_for_user(target)
        return f"/admin/producer-preview/{producer.id}?{_admin_preview_query()}" if producer else "/producers"
    if target_type == ModerationReport.TargetType.REVIEW and isinstance(target, ProductReview):
        return _public_product_url(target.product)
    if target_type == ModerationReport.TargetType.RECIPE:
        return f"/admin/content-preview/recipes?{_admin_preview_query(recipeId=target.id)}"
    if target_type == ModerationReport.TargetType.FARM_STORY:
        return f"/admin/content-preview/stories?{_admin_preview_query(storyId=target.id)}"
    return ""


def _visibility_for_target(target_type: str, target: Any) -> str:
    if isinstance(target, User):
        return "active" if target.is_active else "deactivated"
    if isinstance(target, OrderProduct):
        return "live" if target.is_available else "removed"
    if isinstance(target, CatalogProduct):
        return "removed" if target.availability == CatalogProduct.Availability.UNAVAILABLE else "live"
    if isinstance(target, ProductReview):
        return "live" if target.moderation_status == ProductReview.ModerationStatus.PUBLISHED else "removed"
    if isinstance(target, (Recipe, FarmStory)):
        return "live" if target.is_published else "removed"
    return "unknown"


def _owner_for_target(target_type: str, target: Any) -> dict[str, Any]:
    if isinstance(target, User):
        producer = _producer_for_user(target) if target.role == User.Role.PRODUCER else None
        return {
            "id": target.id,
            "label": producer.business_name if producer else _user_profile_name(target),
            "email": target.email,
            "role": target.role,
        }
    if isinstance(target, OrderProduct):
        return {
            "id": target.producer.user_id,
            "label": target.producer.business_name,
            "email": target.producer.contact_email,
            "role": User.Role.PRODUCER,
        }
    if isinstance(target, CatalogProduct):
        return {
            "id": target.producer_id,
            "label": target.producer.name,
            "email": "",
            "role": User.Role.PRODUCER,
        }
    if isinstance(target, ProductReview):
        return {
            "id": target.user_id,
            "label": target.user.email if target.user_id else target.reviewer_name,
            "email": target.user.email if target.user_id else "",
            "role": target.user.role if target.user_id else "",
        }
    if isinstance(target, (Recipe, FarmStory)):
        return {
            "id": target.producer.user_id,
            "label": target.producer.business_name,
            "email": target.producer.contact_email,
            "role": User.Role.PRODUCER,
        }
    return {"id": None, "label": "", "email": "", "role": ""}


def target_type_for_instance(instance: Any) -> str:
    if isinstance(instance, User):
        return (
            ModerationReport.TargetType.PRODUCER_ACCOUNT
            if instance.role == User.Role.PRODUCER
            else ModerationReport.TargetType.CUSTOMER_ACCOUNT
        )
    if isinstance(instance, (CatalogProduct, OrderProduct)):
        return ModerationReport.TargetType.PRODUCT
    if isinstance(instance, ProductReview):
        return ModerationReport.TargetType.REVIEW
    if isinstance(instance, Recipe):
        return ModerationReport.TargetType.RECIPE
    if isinstance(instance, FarmStory):
        return ModerationReport.TargetType.FARM_STORY
    raise ValueError("Unsupported moderation target.")


def get_target(target_type: str, object_id: int):
    if target_type == ModerationReport.TargetType.PRODUCT:
        order_target = OrderProduct.objects.filter(id=object_id).first()
        catalog_target = CatalogProduct.objects.filter(id=object_id).first()
        if catalog_target is not None and order_target is not None:
            catalog_ct = ContentType.objects.get_for_model(catalog_target, for_concrete_model=False)
            order_ct = ContentType.objects.get_for_model(order_target, for_concrete_model=False)
            catalog_has_history = (
                ModerationReport.objects.filter(content_type=catalog_ct, object_id=object_id).exists()
                or ModerationAction.objects.filter(content_type=catalog_ct, object_id=object_id).exists()
            )
            order_has_history = (
                ModerationReport.objects.filter(content_type=order_ct, object_id=object_id).exists()
                or ModerationAction.objects.filter(content_type=order_ct, object_id=object_id).exists()
            )
            if catalog_has_history and not order_has_history:
                return catalog_target
        if order_target is not None:
            return order_target
        if catalog_target is not None:
            return catalog_target
        raise OrderProduct.DoesNotExist
    model = TARGET_MODEL_MAP.get(target_type)
    if model is None:
        raise ValueError("Unsupported moderation target type.")
    queryset = model.objects.all()
    if model is User and target_type == ModerationReport.TargetType.PRODUCER_ACCOUNT:
        queryset = queryset.filter(role=User.Role.PRODUCER)
    if model is User and target_type == ModerationReport.TargetType.CUSTOMER_ACCOUNT:
        queryset = queryset.filter(role__in=[User.Role.CUSTOMER, User.Role.COMMUNITY, User.Role.RESTAURANT])
    return queryset.get(id=object_id)


def snapshot_target(target: Any, target_type: str) -> dict[str, Any]:
    if isinstance(target, User):
        producer = _producer_for_user(target) if target.role == User.Role.PRODUCER else None
        return {
            "id": target.id,
            "email": target.email,
            "username": getattr(target, "username", ""),
            "role": target.role,
            "is_active": target.is_active,
            "display_name": _user_profile_name(target),
            "producer_id": producer.id if producer else None,
            "producer_company": producer.business_name if producer else "",
            "postcode": producer.postcode if producer else "",
        }
    if isinstance(target, OrderProduct):
        return {
            "id": target.id,
            "name": target.name,
            "producer": target.producer.business_name,
            "category": target.category,
            "is_available": target.is_available,
            "price": str(target.price),
        }
    if isinstance(target, CatalogProduct):
        return {
            "id": target.id,
            "name": target.name,
            "producer": target.producer.name,
            "category": target.category.name,
            "availability": target.availability,
            "stock": target.stock,
            "price": str(target.price),
        }
    if isinstance(target, ProductReview):
        return {
            "id": target.id,
            "title": target.title,
            "reviewer_name": target.user.email if target.user_id else target.reviewer_name,
            "reviewer_display_name": target.reviewer_name,
            "reviewer_email": target.user.email if target.user_id else "",
            "reviewer_user_id": target.user_id,
            "is_anonymous_to_public": target.is_anonymous,
            "rating": target.rating,
            "comment": target.comment,
            "product": target.product.name,
            "producer": target.product.producer.name,
            "moderation_status": target.moderation_status,
        }
    if isinstance(target, Recipe):
        return {
            "id": target.id,
            "title": target.title,
            "producer": target.producer.business_name,
            "is_published": target.is_published,
            "description": target.description,
        }
    if isinstance(target, FarmStory):
        return {
            "id": target.id,
            "title": target.title,
            "producer": target.producer.business_name,
            "is_published": target.is_published,
            "body": target.body[:240],
        }
    return {"id": getattr(target, "id", None), "type": target_type}


def moderation_context_for_user(user: User) -> dict[str, Any]:
    related_items: list[dict[str, Any]] = []
    if user.role == User.Role.PRODUCER:
        related_items.extend(
            {
                "type": "product",
                "id": product.id,
                "label": product.name,
                "status": "available" if product.is_available else "unavailable",
            }
            for product in OrderProduct.objects.filter(producer__user=user).order_by("name")[:12]
        )
        related_items.extend(
            {
                "type": "recipe",
                "id": recipe.id,
                "label": recipe.title,
                "status": "published" if recipe.is_published else "unpublished",
            }
            for recipe in Recipe.objects.filter(producer__user=user).order_by("-created_at")[:8]
        )
        related_items.extend(
            {
                "type": "farm_story",
                "id": story.id,
                "label": story.title,
                "status": "published" if story.is_published else "unpublished",
            }
            for story in FarmStory.objects.filter(producer__user=user).order_by("-created_at")[:8]
        )
    else:
        related_items.extend(
            {
                "type": "review",
                "id": review.id,
                "label": review.title or f"{review.rating}-star review",
                "status": review.moderation_status,
            }
            for review in ProductReview.objects.filter(user=user).select_related("product").order_by("-created_at")[:12]
        )

    return {
        "profile": {
            "id": user.id,
            "email": user.email,
            "display_name": _user_profile_name(user),
            "username": getattr(user, "username", ""),
            "role": user.role,
            "active": user.is_active,
            "joined": user.date_joined.isoformat() if user.date_joined else "",
        },
        "related_items": related_items,
    }


def moderation_context_for_report(report: ModerationReport) -> dict[str, Any]:
    target = report.target
    if target is None:
        return {"profile": {}, "related_items": []}

    if isinstance(target, User):
        return moderation_context_for_user(target)

    if isinstance(target, OrderProduct):
        return {
            "profile": {
                "producer": target.producer.business_name,
                "producer_user_id": target.producer.user_id,
                "category": target.category,
                "stock": str(target.stock_quantity),
                "available": target.is_available,
            },
            "related_items": [
                {
                    "type": "review",
                    "id": review.id,
                    "label": review.title or f"{review.rating}-star review",
                    "status": review.moderation_status,
                }
                for review in ProductReview.objects.filter(
                    product__name=target.name,
                    product__producer__name=target.producer.business_name,
                ).order_by("-created_at")[:8]
            ],
        }

    if isinstance(target, ProductReview):
        return {
            "profile": {
                "reviewer": target.user.email if target.user_id else target.reviewer_name,
                "reviewer_display_name": target.reviewer_name,
                "reviewer_user_id": target.user_id,
                "product": target.product.name,
                "rating": target.rating,
                "status": target.moderation_status,
            },
            "related_items": [],
        }

    if isinstance(target, (Recipe, FarmStory)):
        return {
            "profile": {
                "producer": target.producer.business_name,
                "producer_user_id": target.producer.user_id,
                "published": target.is_published,
            },
            "related_items": [],
        }

    return {"profile": {}, "related_items": []}


def _moderation_key(target_type: str, target: Any) -> tuple[str, str]:
    content_type = ContentType.objects.get_for_model(target, for_concrete_model=False)
    return target_type, f"{content_type.app_label}.{content_type.model}:{target.id}"


def _report_counts_for_targets(
    targets: list[tuple[str, Any]],
) -> tuple[
    dict[tuple[str, str], int],
    dict[tuple[str, str], int],
    dict[tuple[str, str], int],
    dict[tuple[str, str], int],
]:
    if not targets:
        return {}, {}, {}, {}
    open_counts: dict[tuple[str, str], int] = {}
    kept_counts: dict[tuple[str, str], int] = {}
    removed_counts: dict[tuple[str, str], int] = {}
    total_counts: dict[tuple[str, str], int] = {}
    for target_type, target in targets:
        content_type = ContentType.objects.get_for_model(target, for_concrete_model=False)
        object_id = target.id
        counts = (
            ModerationReport.objects.filter(content_type=content_type, object_id=object_id)
            .values("status")
            .annotate(count=Count("id"))
        )
        for row in counts:
            key = _moderation_key(target_type, target)
            total_counts[key] = total_counts.get(key, 0) + int(row["count"])
            if row["status"] == ModerationReport.Status.OPEN:
                open_counts[key] = int(row["count"])
            if row["status"] == ModerationReport.Status.KEPT:
                kept_counts[key] = int(row["count"])
            if row["status"] == ModerationReport.Status.REMOVED:
                removed_counts[key] = int(row["count"])
    return open_counts, total_counts, kept_counts, removed_counts


def _action_counts_for_targets(targets: list[tuple[str, Any]]) -> tuple[dict[tuple[str, str], int], dict[tuple[str, str], int]]:
    if not targets:
        return {}, {}
    keep_counts: dict[tuple[str, str], int] = {}
    removal_counts: dict[tuple[str, str], int] = {}
    for target_type, target in targets:
        content_type = ContentType.objects.get_for_model(target, for_concrete_model=False)
        object_id = target.id
        counts = (
            ModerationAction.objects.filter(content_type=content_type, object_id=object_id)
            .values("action")
            .annotate(count=Count("id"))
        )
        for row in counts:
            key = _moderation_key(target_type, target)
            if row["action"] == ModerationAction.Action.KEEP_LIVE:
                keep_counts[key] = keep_counts.get(key, 0) + int(row["count"])
            if row["action"] in {ModerationAction.Action.REMOVE, ModerationAction.Action.DEACTIVATE}:
                removal_counts[key] = removal_counts.get(key, 0) + int(row["count"])
    return keep_counts, removal_counts


def moderation_item_payload(
    target: Any,
    target_type: str,
    *,
    open_count: int = 0,
    total_count: int = 0,
    kept_count: int = 0,
    removed_count: int = 0,
    keep_action_count: int = 0,
    removal_action_count: int = 0,
) -> dict[str, Any]:
    snapshot = snapshot_target(target, target_type)
    label = (
        snapshot.get("producer_company")
        or snapshot.get("title")
        or snapshot.get("name")
        or snapshot.get("display_name")
        or snapshot.get("email")
        or f"{target_type} #{target.id}"
    )
    subtitle = ""
    if isinstance(target, User):
        subtitle = target.email
    elif isinstance(target, OrderProduct):
        subtitle = f"{target.producer.business_name} · {target.category or 'Uncategorised'}"
    elif isinstance(target, CatalogProduct):
        subtitle = f"{target.producer.name} · {target.category.name if target.category_id else 'Uncategorised'}"
    elif isinstance(target, ProductReview):
        subtitle = f"{target.product.name} · {target.rating}/5"
    elif isinstance(target, (Recipe, FarmStory)):
        subtitle = target.producer.business_name

    return {
        "target_type": target_type,
        "object_id": target.id,
        "label": label,
        "subtitle": subtitle,
        "visibility": _visibility_for_target(target_type, target),
        "owner": _owner_for_target(target_type, target),
        "snapshot": snapshot,
        "public_url": _public_url_for_target(target_type, target),
        "open_report_count": open_count,
        "total_report_count": total_count,
        "kept_report_count": kept_count,
        "removed_report_count": removed_count,
        "keep_action_count": keep_action_count,
        "removal_action_count": removal_action_count,
        "last_updated": getattr(target, "updated_at", None) or getattr(target, "created_at", None) or getattr(target, "date_joined", None),
    }


def _matches_text(text: str, query: str) -> bool:
    return not query or query.lower() in text.lower()


def _target_allowed_for_type(target_type: str, target: Any) -> bool:
    if target is None:
        return False
    if isinstance(target, User):
        if target.role == User.Role.ADMIN:
            return False
        if target_type == ModerationReport.TargetType.PRODUCER_ACCOUNT:
            return target.role == User.Role.PRODUCER
        if target_type == ModerationReport.TargetType.CUSTOMER_ACCOUNT:
            return target.role in ACCOUNT_ROLES
    return True


def _add_collected_target(collected: list[tuple[str, Any]], target_type: str, target: Any) -> None:
    if target_type not in TARGET_MODEL_MAP or not _target_allowed_for_type(target_type, target):
        return
    if any(
        existing_type == target_type and existing.__class__ == target.__class__ and existing.id == target.id
        for existing_type, existing in collected
    ):
        return
    collected.append((target_type, target))


def _item_matches_query_or_owner(item: dict[str, Any], *, query: str, owner: str) -> bool:
    searchable = json.dumps(
        {
            "label": item.get("label", ""),
            "subtitle": item.get("subtitle", ""),
            "owner": item.get("owner", {}),
            "snapshot": item.get("snapshot", {}),
        },
        default=str,
    ).lower()
    if query and query.lower() not in searchable:
        return False
    if owner:
        owner_text = json.dumps(item.get("owner", {}), default=str).lower()
        if owner.lower() not in owner_text:
            return False
    return True


def _append_report_history_targets(collected: list[tuple[str, Any]], *, selected_types: list[str], statuses: set[str]) -> None:
    reports = ModerationReport.objects.filter(target_type__in=selected_types, status__in=statuses).select_related("content_type")
    for report in reports[:500]:
        _add_collected_target(collected, report.target_type, report.target)


def _append_action_history_targets(collected: list[tuple[str, Any]], *, selected_types: list[str], actions: set[str]) -> None:
    rows = ModerationAction.objects.filter(target_type__in=selected_types, action__in=actions).select_related("content_type")
    for row in rows[:500]:
        _add_collected_target(collected, row.target_type, row.target)


def _append_current_removed_targets(collected: list[tuple[str, Any]], *, selected_types: list[str]) -> None:
    # this adds hidden things even when there is no open report left
    if ModerationReport.TargetType.CUSTOMER_ACCOUNT in selected_types:
        for user in User.objects.filter(role__in=ACCOUNT_ROLES, is_active=False)[:300]:
            _add_collected_target(collected, ModerationReport.TargetType.CUSTOMER_ACCOUNT, user)
    if ModerationReport.TargetType.PRODUCER_ACCOUNT in selected_types:
        for user in User.objects.filter(role=User.Role.PRODUCER, is_active=False)[:300]:
            _add_collected_target(collected, ModerationReport.TargetType.PRODUCER_ACCOUNT, user)
    if ModerationReport.TargetType.PRODUCT in selected_types:
        for product in OrderProduct.objects.select_related("producer", "producer__user").filter(is_available=False)[:300]:
            _add_collected_target(collected, ModerationReport.TargetType.PRODUCT, product)
    if ModerationReport.TargetType.REVIEW in selected_types:
        for review in ProductReview.objects.select_related("user", "product", "product__producer").filter(
            moderation_status=ProductReview.ModerationStatus.REJECTED
        )[:300]:
            _add_collected_target(collected, ModerationReport.TargetType.REVIEW, review)
    if ModerationReport.TargetType.RECIPE in selected_types:
        for recipe in Recipe.objects.select_related("producer", "producer__user").filter(is_published=False)[:300]:
            _add_collected_target(collected, ModerationReport.TargetType.RECIPE, recipe)
    if ModerationReport.TargetType.FARM_STORY in selected_types:
        for story in FarmStory.objects.select_related("producer", "producer__user").filter(is_published=False)[:300]:
            _add_collected_target(collected, ModerationReport.TargetType.FARM_STORY, story)


def browse_moderation_items(
    *,
    query: str = "",
    target_type: str = "",
    visibility: str = "",
    reported: str = "",
    owner: str = "",
    page: int = 1,
    page_size: int = 24,
) -> dict[str, Any]:
    query = query.strip()
    owner = owner.strip()
    # removed and kept are decision filters so they should not clash with live status
    if reported in {"removed", "kept"}:
        visibility = ""
    allowed_types = [choice for choice, _ in ModerationReport.TargetType.choices]
    selected_types = [target_type] if target_type in allowed_types else allowed_types
    collected: list[tuple[str, Any]] = []

    if ModerationReport.TargetType.CUSTOMER_ACCOUNT in selected_types:
        # customer account covers normal customer community and restaurant users
        users = User.objects.exclude(role__in=[User.Role.ADMIN, User.Role.PRODUCER])
        if query:
            users = users.filter(
                Q(email__icontains=query)
                | Q(role__icontains=query)
                | Q(customer_profile__full_name__icontains=query)
                | Q(customer_profile__first_name__icontains=query)
                | Q(customer_profile__last_name__icontains=query)
                | Q(community_profile__organisation_name__icontains=query)
                | Q(community_profile__contact_name__icontains=query)
                | Q(restaurant_profile__business_name__icontains=query)
                | Q(restaurant_profile__contact_name__icontains=query)
            )
        if owner:
            users = users.filter(Q(email__icontains=owner) | Q(role__icontains=owner))
        for user in users.distinct()[:80]:
            _add_collected_target(collected, ModerationReport.TargetType.CUSTOMER_ACCOUNT, user)

    if ModerationReport.TargetType.PRODUCER_ACCOUNT in selected_types:
        # producer search checks both account profile and marketplace producer profile
        users = User.objects.filter(role=User.Role.PRODUCER)
        if query:
            users = users.filter(
                Q(email__icontains=query)
                | Q(producer_profile__business_name__icontains=query)
                | Q(producer_profile__contact_name__icontains=query)
                | Q(orders_producer_profile__business_name__icontains=query)
                | Q(orders_producer_profile__contact_email__icontains=query)
                | Q(orders_producer_profile__postcode__icontains=query)
            )
        if owner:
            users = users.filter(
                Q(email__icontains=owner)
                | Q(producer_profile__business_name__icontains=owner)
                | Q(orders_producer_profile__business_name__icontains=owner)
            )
        for user in users.distinct()[:80]:
            _add_collected_target(collected, ModerationReport.TargetType.PRODUCER_ACCOUNT, user)

    if ModerationReport.TargetType.PRODUCT in selected_types:
        products = OrderProduct.objects.select_related("producer", "producer__user")
        if query:
            products = products.filter(
                Q(name__icontains=query)
                | Q(description__icontains=query)
                | Q(category__icontains=query)
                | Q(producer__business_name__icontains=query)
                | Q(producer__contact_email__icontains=query)
            )
        if owner:
            products = products.filter(Q(producer__business_name__icontains=owner) | Q(producer__contact_email__icontains=owner))
        for product in products.distinct()[:100]:
            _add_collected_target(collected, ModerationReport.TargetType.PRODUCT, product)

    if ModerationReport.TargetType.REVIEW in selected_types:
        reviews = ProductReview.objects.select_related("user", "product", "product__producer")
        if query:
            reviews = reviews.filter(
                Q(title__icontains=query)
                | Q(comment__icontains=query)
                | Q(reviewer_name__icontains=query)
                | Q(user__email__icontains=query)
                | Q(product__name__icontains=query)
                | Q(product__producer__name__icontains=query)
            )
        if owner:
            reviews = reviews.filter(Q(user__email__icontains=owner) | Q(reviewer_name__icontains=owner))
        for review in reviews.distinct()[:100]:
            _add_collected_target(collected, ModerationReport.TargetType.REVIEW, review)

    if ModerationReport.TargetType.RECIPE in selected_types:
        recipes = Recipe.objects.select_related("producer", "producer__user")
        if query:
            recipes = recipes.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(ingredients__icontains=query)
                | Q(instructions__icontains=query)
                | Q(producer__business_name__icontains=query)
            )
        if owner:
            recipes = recipes.filter(Q(producer__business_name__icontains=owner) | Q(producer__contact_email__icontains=owner))
        for recipe in recipes.distinct()[:100]:
            _add_collected_target(collected, ModerationReport.TargetType.RECIPE, recipe)

    if ModerationReport.TargetType.FARM_STORY in selected_types:
        stories = FarmStory.objects.select_related("producer", "producer__user")
        if query:
            stories = stories.filter(
                Q(title__icontains=query)
                | Q(body__icontains=query)
                | Q(seasonal_tag__icontains=query)
                | Q(producer__business_name__icontains=query)
            )
        if owner:
            stories = stories.filter(Q(producer__business_name__icontains=owner) | Q(producer__contact_email__icontains=owner))
        for story in stories.distinct()[:100]:
            _add_collected_target(collected, ModerationReport.TargetType.FARM_STORY, story)

    if visibility in {"removed", "deactivated"} or reported == "removed":
        # current removed view must include things hidden by direct admin action
        _append_current_removed_targets(collected, selected_types=selected_types)
    if reported == "removed":
        # removed decision view also brings back old targets from report history
        _append_report_history_targets(collected, selected_types=selected_types, statuses={ModerationReport.Status.REMOVED})
        _append_action_history_targets(
            collected,
            selected_types=selected_types,
            actions={ModerationAction.Action.REMOVE, ModerationAction.Action.DEACTIVATE},
        )
    if reported == "kept":
        # kept live view is based on decisions not just current visibility
        _append_report_history_targets(collected, selected_types=selected_types, statuses={ModerationReport.Status.KEPT})
        _append_action_history_targets(
            collected,
            selected_types=selected_types,
            actions={ModerationAction.Action.KEEP_LIVE},
        )

    targets = collected
    open_counts, total_counts, kept_counts, removed_counts = _report_counts_for_targets(targets)
    keep_action_counts, removal_action_counts = _action_counts_for_targets(targets)
    # each target gets normalized into one card shaped payload for the admin ui
    items = [
        moderation_item_payload(
            target,
            item_type,
            open_count=open_counts.get(_moderation_key(item_type, target), 0),
            total_count=total_counts.get(_moderation_key(item_type, target), 0),
            kept_count=kept_counts.get(_moderation_key(item_type, target), 0),
            removed_count=removed_counts.get(_moderation_key(item_type, target), 0),
            keep_action_count=keep_action_counts.get(_moderation_key(item_type, target), 0),
            removal_action_count=removal_action_counts.get(_moderation_key(item_type, target), 0),
        )
        for item_type, target in collected
    ]
    if query or owner:
        # history targets can be appended after search so filter them again here
        items = [item for item in items if _item_matches_query_or_owner(item, query=query, owner=owner)]
    if visibility:
        items = [item for item in items if item["visibility"] == visibility]
    if reported == "reported":
        items = [item for item in items if item["open_report_count"] > 0]
    elif reported == "unreported":
        items = [item for item in items if item["total_report_count"] == 0]
    elif reported == "kept":
        items = [item for item in items if item["kept_report_count"] > 0 or item["keep_action_count"] > 0]
    elif reported == "removed":
        items = [
            item
            for item in items
            if item["removed_report_count"] > 0
            or item["removal_action_count"] > 0
            or item["visibility"] in {"removed", "deactivated"}
        ]

    items.sort(key=lambda row: str(row.get("last_updated") or ""), reverse=True)
    total = len(items)
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    # page size is capped so moderation searches cannot return huge payloads
    start = (page - 1) * page_size
    end = start + page_size
    return {"count": total, "page": page, "page_size": page_size, "results": items[start:end]}


def moderation_item_detail(target_type: str, object_id: int) -> dict[str, Any]:
    target = get_target(target_type, object_id)
    item = moderation_item_payload(target, target_type)
    content_type = ContentType.objects.get_for_model(target, for_concrete_model=False)
    reports = ModerationReport.objects.filter(content_type=content_type, object_id=target.id).select_related("reported_by", "resolved_by")
    actions = ModerationAction.objects.filter(content_type=content_type, object_id=target.id).select_related("admin_user")
    return {
        **item,
        "context": moderation_context_for_report(type("ReportProxy", (), {"target": target})())
        if not isinstance(target, User)
        else moderation_context_for_user(target),
        "reports": reports,
        "actions": actions,
    }


def _record_action(target: Any, target_type: str, *, action: str, admin_user, note: str, before: dict[str, Any]) -> ModerationAction:
    content_type = ContentType.objects.get_for_model(target, for_concrete_model=False)
    return ModerationAction.objects.create(
        target_type=target_type,
        content_type=content_type,
        object_id=target.id,
        action=action,
        note=note.strip(),
        admin_user=admin_user,
        before_snapshot=before,
        after_snapshot=snapshot_target(target, target_type),
    )


@transaction.atomic
def apply_moderation_action(*, target_type: str, object_id: int, action: str, admin_user, note: str) -> dict[str, Any]:
    note = note.strip()
    if not note:
        raise ValueError("A moderation note is required.")
    if action not in {choice for choice, _ in ModerationAction.Action.choices}:
        raise ValueError("Unsupported moderation action.")

    target = get_target(target_type, object_id)
    before = snapshot_target(target, target_type)

    if isinstance(target, User):
        if target.role == User.Role.ADMIN:
            raise ValueError("Admin accounts cannot be managed from moderation.")
        if action not in {ModerationAction.Action.DEACTIVATE, ModerationAction.Action.REACTIVATE}:
            raise ValueError("Accounts can only be deactivated or reactivated.")
        target.is_active = action == ModerationAction.Action.REACTIVATE
        target.save(update_fields=["is_active"])
        if target.role == User.Role.PRODUCER:
            OrderProducer.objects.filter(user=target).update(is_active=target.is_active)
    elif isinstance(target, OrderProduct):
        if action == ModerationAction.Action.REMOVE:
            target.is_available = False
            target.save(update_fields=["is_available", "updated_at"])
            try:
                catalog_product = get_or_create_catalog_product_mirror(target)
                catalog_product.availability = CatalogProduct.Availability.UNAVAILABLE
                catalog_product.stock = 0
                catalog_product.save(update_fields=["availability", "stock", "updated_at"])
            except Exception:
                pass
        elif action == ModerationAction.Action.RESTORE:
            target.is_available = True
            target.save(update_fields=["is_available", "updated_at"])
            try:
                catalog_product = get_or_create_catalog_product_mirror(target)
                catalog_product.availability = CatalogProduct.Availability.YEAR_ROUND
                catalog_product.stock = max(1, int(target.stock_quantity))
                catalog_product.save(update_fields=["availability", "stock", "updated_at"])
            except Exception:
                pass
        else:
            raise ValueError("Products can only be removed or restored.")
    elif isinstance(target, CatalogProduct):
        if action == ModerationAction.Action.REMOVE:
            target.availability = CatalogProduct.Availability.UNAVAILABLE
            target.stock = 0
            target.save(update_fields=["availability", "stock", "updated_at"])
            OrderProduct.objects.filter(
                producer__business_name=target.producer.name,
                name=target.name,
                unit=target.unit,
            ).update(is_available=False, stock_quantity=0)
        elif action == ModerationAction.Action.RESTORE:
            target.availability = CatalogProduct.Availability.YEAR_ROUND
            target.stock = max(1, int(target.stock or 0))
            target.save(update_fields=["availability", "stock", "updated_at"])
        else:
            raise ValueError("Products can only be removed or restored.")
    elif isinstance(target, ProductReview):
        if action == ModerationAction.Action.REMOVE:
            target.moderation_status = ProductReview.ModerationStatus.REJECTED
            target.moderation_reason = note
            target.save(update_fields=["moderation_status", "moderation_reason"])
        elif action == ModerationAction.Action.RESTORE:
            target.moderation_status = ProductReview.ModerationStatus.PUBLISHED
            target.moderation_reason = ""
            target.save(update_fields=["moderation_status", "moderation_reason"])
        else:
            raise ValueError("Reviews can only be removed or restored.")
    elif isinstance(target, Recipe):
        if action not in {ModerationAction.Action.REMOVE, ModerationAction.Action.RESTORE}:
            raise ValueError("Recipes can only be removed or restored.")
        target.is_published = action == ModerationAction.Action.RESTORE
        target.save(update_fields=["is_published", "updated_at"])
    elif isinstance(target, FarmStory):
        if action not in {ModerationAction.Action.REMOVE, ModerationAction.Action.RESTORE}:
            raise ValueError("Farm stories can only be removed or restored.")
        target.is_published = action == ModerationAction.Action.RESTORE
        target.save(update_fields=["is_published", "updated_at"])
    else:
        raise ValueError("Unsupported moderation target.")

    recorded_action = _record_action(target, target_type, action=action, admin_user=admin_user, note=note, before=before)
    return {"item": moderation_item_payload(target, target_type), "action": recorded_action}


def create_report(*, target_type: str, object_id: int, reported_by, reason: str = "") -> ModerationReport:
    target = get_target(target_type, object_id)
    content_type = ContentType.objects.get_for_model(target, for_concrete_model=False)
    reporter = reported_by if getattr(reported_by, "is_authenticated", False) else None
    if reporter is not None and ModerationReport.objects.filter(
        content_type=content_type,
        object_id=target.id,
        reported_by=reporter,
    ).exists():
        raise ValueError("You have already reported this item.")

    return ModerationReport.objects.create(
        content_type=content_type,
        object_id=target.id,
        reported_by=reporter,
        target_type=target_type,
        reason=reason.strip(),
        target_snapshot=snapshot_target(target, target_type),
    )


def get_user_report(*, target_type: str, object_id: int, reported_by) -> ModerationReport | None:
    target = get_target(target_type, object_id)
    content_type = ContentType.objects.get_for_model(target, for_concrete_model=False)
    reporter = reported_by if getattr(reported_by, "is_authenticated", False) else None
    if reporter is None:
        return None
    return (
        ModerationReport.objects.filter(
            content_type=content_type,
            object_id=target.id,
            reported_by=reporter,
        )
        .order_by("-created_at")
        .first()
    )


@transaction.atomic
def remove_reported_target(report: ModerationReport, *, admin_user, note: str = "") -> ModerationReport:
    if report.status != ModerationReport.Status.OPEN:
        raise ValueError("Only open reported items can be removed.")
    target = report.target
    if target is None:
        raise ValueError("The reported item no longer exists.")

    if isinstance(target, User):
        target.is_active = False
        target.save(update_fields=["is_active"])
    elif isinstance(target, OrderProduct):
        target.is_available = False
        target.save(update_fields=["is_available", "updated_at"])
        try:
            catalog_product = get_or_create_catalog_product_mirror(target)
            catalog_product.availability = CatalogProduct.Availability.UNAVAILABLE
            catalog_product.stock = 0
            catalog_product.save(update_fields=["availability", "stock", "updated_at"])
        except Exception:
            pass
    elif isinstance(target, CatalogProduct):
        target.availability = CatalogProduct.Availability.UNAVAILABLE
        target.stock = 0
        target.save(update_fields=["availability", "stock", "updated_at"])
        OrderProduct.objects.filter(
            producer__business_name=target.producer.name,
            name=target.name,
            unit=target.unit,
        ).update(is_available=False, stock_quantity=0)
    elif isinstance(target, ProductReview):
        target.moderation_status = ProductReview.ModerationStatus.REJECTED
        target.moderation_reason = note or "Removed after user report."
        target.save(update_fields=["moderation_status", "moderation_reason"])
    elif isinstance(target, Recipe):
        target.is_published = False
        target.save(update_fields=["is_published", "updated_at"])
    elif isinstance(target, FarmStory):
        target.is_published = False
        target.save(update_fields=["is_published", "updated_at"])
    else:
        raise ValueError("Unsupported moderation target.")

    report.status = ModerationReport.Status.REMOVED
    report.removed_at = timezone.now()
    report.resolved_by = admin_user
    report.resolution_note = note.strip()
    report.target_snapshot = snapshot_target(target, report.target_type)
    report.save(update_fields=["status", "removed_at", "resolved_by", "resolution_note", "target_snapshot", "updated_at"])
    _record_action(target, report.target_type, action=ModerationAction.Action.REMOVE, admin_user=admin_user, note=note or "Removed reported target.", before={})
    return report


@transaction.atomic
def keep_reported_target(report: ModerationReport, *, admin_user, note: str = "") -> ModerationReport:
    if report.status != ModerationReport.Status.OPEN:
        raise ValueError("Only open reported items can be kept.")
    report.status = ModerationReport.Status.KEPT
    report.kept_at = timezone.now()
    report.resolved_by = admin_user
    report.resolution_note = note.strip()
    report.save(update_fields=["status", "kept_at", "resolved_by", "resolution_note", "updated_at"])
    target = report.target
    if target is not None:
        _record_action(target, report.target_type, action=ModerationAction.Action.KEEP_LIVE, admin_user=admin_user, note=note or "Kept reported target live.", before=snapshot_target(target, report.target_type))
    return report
