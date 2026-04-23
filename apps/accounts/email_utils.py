from __future__ import annotations

from dataclasses import dataclass
import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.utils import timezone

from .auth_tokens import (
    build_frontend_link,
    generate_email_verification_token,
    generate_password_reset_token,
)

logger = logging.getLogger("apps.accounts.email")


@dataclass(frozen=True)
class AccountEmailDeliveryResult:
    sent: bool
    skipped: bool
    reason: str = ""


DEFAULT_SUPPRESSED_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "invalid",
    "localhost",
    "local",
    "localfood.test",
    "test",
}
DEFAULT_SUPPRESSED_LOCAL_PARTS = {
    "dummy",
    "example",
    "fake",
    "test",
}


def _csv_setting(name: str, defaults: set[str]) -> set[str]:
    configured = getattr(settings, name, None)
    if configured is None:
        return defaults
    if isinstance(configured, str):
        return {item.strip().lower() for item in configured.split(",") if item.strip()}
    return {str(item).strip().lower() for item in configured if str(item).strip()}


def _is_suppressed_email(email: str) -> tuple[bool, str]:
    try:
        validate_email(email)
    except ValidationError:
        return True, "invalid_email"

    local_part, _, domain = email.lower().partition("@")
    suppressed_domains = _csv_setting("ACCOUNT_EMAIL_SUPPRESS_DOMAINS", DEFAULT_SUPPRESSED_DOMAINS)
    suppressed_local_parts = _csv_setting("ACCOUNT_EMAIL_SUPPRESS_LOCAL_PARTS", DEFAULT_SUPPRESSED_LOCAL_PARTS)

    if domain in suppressed_domains:
        return True, "suppressed_domain"
    if local_part in suppressed_local_parts:
        return True, "suppressed_local_part"
    return False, ""


def _send_account_email(*, subject: str, message: str, recipient: str) -> AccountEmailDeliveryResult:
    suppressed, reason = _is_suppressed_email(recipient)
    if suppressed:
        logger.info("Skipping account email to %s because %s.", recipient, reason)
        return AccountEmailDeliveryResult(sent=False, skipped=True, reason=reason)

    try:
        sent_count = send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@localfood.test"),
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception as exc:
        logger.exception("Failed to send account email to %s.", recipient)
        return AccountEmailDeliveryResult(sent=False, skipped=False, reason=exc.__class__.__name__)

    return AccountEmailDeliveryResult(sent=sent_count > 0, skipped=False, reason="" if sent_count > 0 else "not_sent")


def send_email_verification_message(user):
    token = generate_email_verification_token(user)
    verification_link = build_frontend_link("/verify-email", token)
    result = _send_account_email(
        subject="Verify your account email",
        message=(
            "Welcome to Local Food Marketplace.\n\n"
            f"Please verify your email by visiting this link:\n{verification_link}\n\n"
            "This link expires in 24 hours."
        ),
        recipient=user.email,
    )
    if result.sent:
        user.email_verification_sent_at = timezone.now()
        user.save(update_fields=["email_verification_sent_at"])
    return result


def send_password_reset_message(user):
    token = generate_password_reset_token(user)
    reset_link = build_frontend_link("/reset-password", token)
    return _send_account_email(
        subject="Reset your password",
        message=(
            "We received a request to reset your password.\n\n"
            f"Reset it using this link:\n{reset_link}\n\n"
            "This link expires in 30 minutes."
        ),
        recipient=user.email,
    )
