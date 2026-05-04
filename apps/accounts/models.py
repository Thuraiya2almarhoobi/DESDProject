"""
DESD Marketplace documentation.

File role:
    Defines persistent database models, relationships, and domain methods for this app.

Domain context:
    Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class UserManager(BaseUserManager):
    """
    Documents the `UserManager` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    use_in_migrations = True

    @staticmethod
    def _email_from_username(username: str | None) -> str:
        if not username:
            return ""
        normalized = "".join(
            char if char.isalnum() or char in {".", "_", "-"} else "-"
            for char in str(username).strip().lower()
        )
        return f"{normalized or 'user'}@local.test"

    def _create_user(self, email: str, password: str, **extra_fields):
        if not email:
            raise ValueError("The email address must be set.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str | None = None, password: str | None = None, **extra_fields):
        username = extra_fields.pop("username", None)
        if not email:
            email = self._email_from_username(username)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.CUSTOMER)
        if password is None:
            raise ValueError("The password must be set.")
        return self._create_user(email=email, password=password, **extra_fields)

    def create_superuser(self, email: str | None = None, password: str | None = None, **extra_fields):
        username = extra_fields.pop("username", None)
        if not email:
            email = self._email_from_username(username)
        if password is None:
            raise ValueError("The password must be set.")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Documents the `User` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Role(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        PRODUCER = "PRODUCER", "Producer"
        COMMUNITY = "COMMUNITY", "Community"
        RESTAURANT = "RESTAURANT", "Restaurant"
        ADMIN = "ADMIN", "Admin"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ("id",)

    def __str__(self) -> str:
        return self.email


class Address(models.Model):
    """
    Documents the `Address` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=50)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    postcode = models.CharField(max_length=20)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=("user",),
                condition=Q(is_default=True),
                name="accounts_unique_default_address_per_user",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.label}"


class CustomerProfile(models.Model):
    """
    Documents the `CustomerProfile` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="customer_profile")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    allergies_text = models.TextField(blank=True)
    preferences_text = models.TextField(blank=True)
    default_address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ("id",)

    def clean(self):
        if self.user.role != User.Role.CUSTOMER:
            raise ValidationError("CustomerProfile can only be linked to CUSTOMER users.")
        if self.default_address and self.default_address.user_id != self.user_id:
            raise ValidationError("default_address must belong to the same user.")

    def __str__(self) -> str:
        return self.full_name


class ProducerProfile(models.Model):
    """
    Documents the `ProducerProfile` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="producer_profile")
    business_name = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=30)
    farm_origin_text = models.TextField(blank=True)
    lead_time_hours = models.PositiveIntegerField(default=48)
    address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ("id",)

    def clean(self):
        if self.user.role != User.Role.PRODUCER:
            raise ValidationError("ProducerProfile can only be linked to PRODUCER users.")
        if self.address and self.address.user_id != self.user_id:
            raise ValidationError("address must belong to the same user.")

    def __str__(self) -> str:
        return self.business_name


class CommunityGroupProfile(models.Model):
    """
    Documents the `CommunityGroupProfile` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="community_profile")
    organisation_name = models.CharField(max_length=255)
    org_type = models.CharField(max_length=100)
    contact_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    delivery_address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ("id",)

    def clean(self):
        if self.user.role != User.Role.COMMUNITY:
            raise ValidationError("CommunityGroupProfile can only be linked to COMMUNITY users.")
        if self.delivery_address and self.delivery_address.user_id != self.user_id:
            raise ValidationError("delivery_address must belong to the same user.")

    def __str__(self) -> str:
        return self.organisation_name


class RestaurantProfile(models.Model):
    """
    Documents the `RestaurantProfile` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="restaurant_profile")
    business_name = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    delivery_address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ("id",)

    def clean(self):
        if self.user.role != User.Role.RESTAURANT:
            raise ValidationError("RestaurantProfile can only be linked to RESTAURANT users.")
        if self.delivery_address and self.delivery_address.user_id != self.user_id:
            raise ValidationError("delivery_address must belong to the same user.")

    def __str__(self) -> str:
        return self.business_name


class LoginAttempt(models.Model):
    """
    Documents the `LoginAttempt` boundary for this module.

    The class belongs to the file role described above: Defines persistent database models, relationships, and domain methods for this app.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    email = models.EmailField()
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_attempts",
    )
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    success = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    reason = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ("-timestamp",)

    def __str__(self) -> str:
        return f"{self.email} | success={self.success} | {self.timestamp.isoformat()}"
