"""
DESD Marketplace documentation.

File role:
    Source module for the community area.

Domain context:
    Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import User
from apps.orders.models import Order, OrderItem, Product as OrdersProduct

from .models import ProductReview

MAX_REVIEWS_PER_24_HOURS = 5

@dataclass(frozen=True)
class ReviewEligibility:
    """
    Documents the `ReviewEligibility` boundary for this module.

    The class belongs to the file role described above: Source module for the community area.
    It keeps related behavior grouped so the community domain: community feedback, review policy, and urls/views used by shared buyer-community workflows.
    can be changed without spreading the same responsibility across unrelated files.
    """
    can_submit: bool
    reason: str
    has_verified_purchase: bool
    has_existing_review: bool
    daily_limit_reached: bool
    is_customer: bool
    is_authenticated: bool


@dataclass(frozen=True)
class ReviewModerationDecision:
    """
    Documents the `ReviewModerationDecision` boundary for this module.

    The class belongs to the file role described above: Source module for the community area.
    It keeps related behavior grouped so the community domain: community feedback, review policy, and urls/views used by shared buyer-community workflows.
    can be changed without spreading the same responsibility across unrelated files.
    """
    status: str
    reason: str


def find_matching_orders_product(catalog_product):
    """
    Helper for the file role: Source module for the community area.

    `find_matching_orders_product` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.
    """
    return (
        OrdersProduct.objects.select_related("producer", "producer__user")
        .filter(
            producer__business_name__iexact=catalog_product.producer.name,
            name__iexact=catalog_product.name,
        )
        .order_by("-updated_at", "-id")
        .first()
    )


def has_verified_purchase(*, user, order_product) -> bool:
    """
    Helper for the file role: Source module for the community area.

    `has_verified_purchase` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.
    """
    if not user or not user.is_authenticated or order_product is None:
        return False

    return OrderItem.objects.filter(
        order__customer=user,
        order__status=Order.Status.DELIVERED,
        sub_order__status=Order.Status.DELIVERED,
        product=order_product,
    ).exists()


def resolve_verified_purchase_status(*, user, catalog_product, order_product=None) -> bool:
    """
    Helper for the file role: Source module for the community area.

    `resolve_verified_purchase_status` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.
    """
    resolved_order_product = order_product or find_matching_orders_product(catalog_product)
    return has_verified_purchase(user=user, order_product=resolved_order_product)


def get_review_eligibility(*, user, catalog_product, order_product=None, require_verified_purchase=False) -> ReviewEligibility:
    """
    Helper for the file role: Source module for the community area.

    `get_review_eligibility` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.
    """
    if not user or not user.is_authenticated:
        return ReviewEligibility(
            can_submit=False,
            reason="Please sign in with a customer account to review this product.",
            has_verified_purchase=False,
            has_existing_review=False,
            daily_limit_reached=False,
            is_customer=False,
            is_authenticated=False,
        )

    is_customer = user.role == User.Role.CUSTOMER
    if not is_customer:
        return ReviewEligibility(
            can_submit=False,
            reason="Only customer accounts can submit reviews.",
            has_verified_purchase=False,
            has_existing_review=False,
            daily_limit_reached=False,
            is_customer=False,
            is_authenticated=True,
        )

    existing_review = (
        ProductReview.objects.filter(product=catalog_product, user=user)
        .exclude(moderation_status=ProductReview.ModerationStatus.REJECTED)
        .order_by("-created_at")
        .first()
    )
    if existing_review is not None:
        if existing_review.moderation_status == ProductReview.ModerationStatus.PENDING:
            reason = "Your review is already pending moderation."
        elif existing_review.moderation_status == ProductReview.ModerationStatus.REJECTED:
            reason = "Your previous review is under moderation review."
        else:
            reason = "You have already reviewed this product."
        return ReviewEligibility(
            can_submit=False,
            reason=reason,
            has_verified_purchase=bool(existing_review.verified_purchase),
            has_existing_review=True,
            daily_limit_reached=False,
            is_customer=True,
            is_authenticated=True,
        )

    reviews_last_day = ProductReview.objects.filter(
        user=user,
        created_at__gte=timezone.now() - timedelta(hours=24),
    ).count()
    if reviews_last_day >= MAX_REVIEWS_PER_24_HOURS:
        return ReviewEligibility(
            can_submit=False,
            reason="You've reached the daily review limit. Please try again tomorrow.",
            has_verified_purchase=False,
            has_existing_review=False,
            daily_limit_reached=True,
            is_customer=True,
            is_authenticated=True,
        )

    verified_purchase = resolve_verified_purchase_status(
        user=user,
        catalog_product=catalog_product,
        order_product=order_product,
    )
    if require_verified_purchase and not verified_purchase:
        return ReviewEligibility(
            can_submit=False,
            reason="You can only review this product after a delivered purchase is recorded.",
            has_verified_purchase=False,
            has_existing_review=False,
            daily_limit_reached=False,
            is_customer=True,
            is_authenticated=True,
        )
    return ReviewEligibility(
        can_submit=True,
        reason=(
            "You purchased this item and can review it now."
            if verified_purchase
            else "You can submit a review, but without a delivered order it will show as Unverified purchase after approval."
        ),
        has_verified_purchase=verified_purchase,
        has_existing_review=False,
        daily_limit_reached=False,
        is_customer=True,
        is_authenticated=True,
    )


def moderate_review_comment(comment: str) -> ReviewModerationDecision:
    """
    Helper for the file role: Source module for the community area.

    `moderate_review_comment` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Community domain: community feedback, review policy, and URLs/views used by shared buyer-community workflows.
    """
    normalized_comment = (comment or "").strip()
    if not normalized_comment:
        return ReviewModerationDecision(
            status=ProductReview.ModerationStatus.PUBLISHED,
            reason="",
        )

    return ReviewModerationDecision(
        status=ProductReview.ModerationStatus.PUBLISHED,
        reason="",
    )
