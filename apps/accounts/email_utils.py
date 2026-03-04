from __future__ import annotations

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .auth_tokens import (
    build_frontend_link,
    generate_email_verification_token,
    generate_password_reset_token,
)


def send_email_verification_message(user):
    token = generate_email_verification_token(user)
    verification_link = build_frontend_link("/verify-email", token)
    send_mail(
        subject="Verify your account email",
        message=(
            "Welcome to Local Food Marketplace.\n\n"
            f"Please verify your email by visiting this link:\n{verification_link}\n\n"
            "This link expires in 24 hours."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@localfood.test"),
        recipient_list=[user.email],
        fail_silently=False,
    )
    user.email_verification_sent_at = timezone.now()
    user.save(update_fields=["email_verification_sent_at"])


def send_password_reset_message(user):
    token = generate_password_reset_token(user)
    reset_link = build_frontend_link("/reset-password", token)
    send_mail(
        subject="Reset your password",
        message=(
            "We received a request to reset your password.\n\n"
            f"Reset it using this link:\n{reset_link}\n\n"
            "This link expires in 30 minutes."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@localfood.test"),
        recipient_list=[user.email],
        fail_silently=False,
    )
