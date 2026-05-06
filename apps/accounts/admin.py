"""
DESD Marketplace documentation.

File role:
    Registers models and operational views with Django admin so staff can inspect and maintain records.

Domain context:
    Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    Address,
    CommunityGroupProfile,
    CustomerProfile,
    LoginAttempt,
    ProducerProfile,
    RestaurantProfile,
    User,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """
    Documents the `UserAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    model = User
    ordering = ("id",)
    list_display = ("email", "role", "is_staff", "is_active")
    list_filter = ("role", "email_verified", "is_staff", "is_superuser", "is_active")
    search_fields = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Role", {"fields": ("role", "email_verified", "email_verification_sent_at")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "role",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                    "email_verified",
                ),
            },
        ),
    )


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    """
    Documents the `AddressAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "user", "label", "city", "postcode", "is_default")
    list_filter = ("is_default", "city")
    search_fields = ("user__email", "label", "postcode")


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    """
    Documents the `CustomerProfileAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "user", "full_name", "phone")
    search_fields = ("user__email", "full_name", "first_name", "last_name", "phone")


@admin.register(ProducerProfile)
class ProducerProfileAdmin(admin.ModelAdmin):
    """
    Documents the `ProducerProfileAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "user", "business_name", "contact_name", "phone", "lead_time_hours")
    search_fields = ("user__email", "business_name", "contact_name", "phone")


@admin.register(CommunityGroupProfile)
class CommunityGroupProfileAdmin(admin.ModelAdmin):
    """
    Documents the `CommunityGroupProfileAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "user", "organisation_name", "org_type", "contact_name")
    search_fields = ("user__email", "organisation_name", "contact_name")


@admin.register(RestaurantProfile)
class RestaurantProfileAdmin(admin.ModelAdmin):
    """
    Documents the `RestaurantProfileAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "user", "business_name", "contact_name", "phone")
    search_fields = ("user__email", "business_name", "contact_name")


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    """
    Documents the `LoginAttemptAdmin` boundary for this module.

    The class belongs to the file role described above: Registers models and operational views with Django admin so staff can inspect and maintain records.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    list_display = ("id", "email", "user", "success", "ip_address", "timestamp", "reason")
    list_filter = ("success", "reason", "timestamp")
    search_fields = ("email", "user__email", "ip_address", "user_agent")
    readonly_fields = ("email", "user", "ip_address", "user_agent", "success", "timestamp", "reason")
