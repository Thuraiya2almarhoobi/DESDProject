"""
DESD Marketplace documentation.

File role:
    Validates API payloads and converts Django model instances into JSON-friendly response shapes.

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

import re
from typing import Any

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from .models import (
    Address,
    CommunityGroupProfile,
    CustomerProfile,
    ProducerProfile,
    RestaurantProfile,
    User,
)

UserModel = get_user_model()


def _infer_city_from_address(address_line: str) -> str:
    """
    Helper for the file role: Validates API payloads and converts Django model instances into JSON-friendly response shapes.

    `_infer_city_from_address` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    parts = [part.strip() for part in address_line.split(",") if part.strip()]
    if len(parts) >= 2:
        return parts[-1]
    return "Bristol"


def _validate_password_complexity(password: str):
    """
    Helper for the file role: Validates API payloads and converts Django model instances into JSON-friendly response shapes.

    `_validate_password_complexity` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    """
    # Django's configured validators handle length/similarity/common-password
    # checks. These explicit checks document the TC-022 complexity requirement
    # and give the frontend clear field-level messages.
    errors = []
    checks = [
        (r"[A-Z]", "Password must contain at least one uppercase letter."),
        (r"[a-z]", "Password must contain at least one lowercase letter."),
        (r"[0-9]", "Password must contain at least one number."),
        (r"[^A-Za-z0-9]", "Password must contain at least one special character."),
    ]

    for pattern, message in checks:
        if not re.search(pattern, password):
            errors.append(message)

    if errors:
        raise serializers.ValidationError(errors)


class UserSummarySerializer(serializers.ModelSerializer):
    """
    Documents the `UserSummarySerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = UserModel
        fields = ("id", "email", "role", "email_verified")


class AddressSerializer(serializers.ModelSerializer):
    """
    Documents the `AddressSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = Address
        fields = ("id", "label", "line1", "line2", "city", "postcode", "is_default")
        read_only_fields = ("id",)

    @transaction.atomic
    def create(self, validated_data):
        # A user can have many saved addresses, but only one should drive
        # checkout defaults, postcode display, and near-me searches.
        user = self.context["request"].user
        if validated_data.get("is_default"):
            Address.objects.filter(user=user, is_default=True).update(is_default=False)
        return Address.objects.create(user=user, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        user = self.context["request"].user
        is_default = validated_data.get("is_default")
        if is_default is True:
            Address.objects.filter(user=user, is_default=True).exclude(pk=instance.pk).update(is_default=False)
        return super().update(instance, validated_data)


class _ProfileAddressValidationMixin:
    """
    Documents the `_ProfileAddressValidationMixin` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    address_field_name: str

    def _validate_address(self, value):
        # Prevent users from assigning another account's saved address to their
        # profile through a crafted API payload.
        if value is None:
            return value
        user = self.context["request"].user
        if value.user_id != user.id:
            raise serializers.ValidationError("Selected address must belong to the authenticated user.")
        return value


class CustomerProfileSerializer(_ProfileAddressValidationMixin, serializers.ModelSerializer):
    """
    Documents the `CustomerProfileSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = CustomerProfile
        fields = ("full_name", "phone", "allergies_text", "preferences_text", "default_address")

    def validate_default_address(self, value):
        return self._validate_address(value)


class ProducerProfileSerializer(_ProfileAddressValidationMixin, serializers.ModelSerializer):
    """
    Documents the `ProducerProfileSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = ProducerProfile
        fields = ("business_name", "contact_name", "phone", "farm_origin_text", "lead_time_hours", "address")

    def validate_address(self, value):
        return self._validate_address(value)


class CommunityGroupProfileSerializer(_ProfileAddressValidationMixin, serializers.ModelSerializer):
    """
    Documents the `CommunityGroupProfileSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = CommunityGroupProfile
        fields = ("organisation_name", "org_type", "contact_name", "phone", "delivery_address")

    def validate_delivery_address(self, value):
        return self._validate_address(value)


class RestaurantProfileSerializer(_ProfileAddressValidationMixin, serializers.ModelSerializer):
    """
    Documents the `RestaurantProfileSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    class Meta:
        model = RestaurantProfile
        fields = ("business_name", "contact_name", "phone", "delivery_address")

    def validate_delivery_address(self, value):
        return self._validate_address(value)


PROFILE_SERIALIZER_BY_ROLE = {
    User.Role.CUSTOMER: CustomerProfileSerializer,
    User.Role.PRODUCER: ProducerProfileSerializer,
    User.Role.COMMUNITY: CommunityGroupProfileSerializer,
    User.Role.RESTAURANT: RestaurantProfileSerializer,
}

PROFILE_MODEL_BY_ROLE = {
    User.Role.CUSTOMER: CustomerProfile,
    User.Role.PRODUCER: ProducerProfile,
    User.Role.COMMUNITY: CommunityGroupProfile,
    User.Role.RESTAURANT: RestaurantProfile,
}


class BaseRegistrationSerializer(serializers.Serializer):
    """
    Documents the `BaseRegistrationSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    user_role: str

    def validate_email(self, value):
        # Email is the login identifier for every role, so uniqueness is checked
        # case-insensitively before creating any role-specific profile records.
        email = UserModel.objects.normalize_email(value)
        if UserModel.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_password(self, value):
        draft_user = UserModel(email=self.initial_data.get("email", ""), role=self.user_role)
        _validate_password_complexity(value)
        validate_password(value, user=draft_user)
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Password confirmation does not match."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # User and profile creation are atomic: if profile validation/persistence
        # fails, the partially-created login account is rolled back too.
        email = validated_data.pop("email")
        password = validated_data.pop("password")
        validated_data.pop("confirm_password", None)
        user = UserModel.objects.create_user(
            email=email,
            password=password,
            role=self.user_role,
            email_verified=False,
        )
        self.create_profile(user, validated_data)
        return user

    def create_profile(self, user: UserModel, profile_data: dict[str, Any]):
        raise NotImplementedError


class CustomerRegistrationSerializer(BaseRegistrationSerializer):
    """
    Documents the `CustomerRegistrationSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user_role = User.Role.CUSTOMER

    full_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=30)
    delivery_address = serializers.CharField(max_length=255)
    postcode = serializers.CharField(max_length=20)
    accept_terms = serializers.BooleanField()

    def validate_accept_terms(self, value):
        if value is not True:
            raise serializers.ValidationError("You must accept terms and conditions.")
        return value

    def create_profile(self, user, profile_data):
        # Customers store delivery address data both as a reusable Address and
        # as the profile's default address reference for checkout/account pages.
        delivery_address = profile_data.pop("delivery_address")
        postcode = profile_data.pop("postcode")
        profile_data.pop("accept_terms", None)

        city = _infer_city_from_address(delivery_address)
        address = Address.objects.create(
            user=user,
            label="Delivery Address",
            line1=delivery_address,
            city=city,
            postcode=postcode,
            is_default=True,
        )

        CustomerProfile.objects.create(user=user, default_address=address, **profile_data)


class ProducerRegistrationSerializer(BaseRegistrationSerializer):
    """
    Documents the `ProducerRegistrationSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user_role = User.Role.PRODUCER

    business_name = serializers.CharField(max_length=255)
    contact_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=30)
    business_address = serializers.CharField(max_length=255)
    postcode = serializers.CharField(max_length=20)
    farm_origin_text = serializers.CharField(required=False, allow_blank=True)
    lead_time_hours = serializers.IntegerField(required=False, min_value=1, default=48)

    def create_profile(self, user, profile_data):
        # Producer registration captures the business address and lead time used
        # later by product pages, delivery-date validation, and producer profile
        # editing.
        business_address = profile_data.pop("business_address")
        postcode = profile_data.pop("postcode")

        city = _infer_city_from_address(business_address)
        address = Address.objects.create(
            user=user,
            label="Business Address",
            line1=business_address,
            city=city,
            postcode=postcode,
            is_default=True,
        )

        ProducerProfile.objects.create(user=user, address=address, **profile_data)


class CommunityRegistrationSerializer(BaseRegistrationSerializer):
    """
    Documents the `CommunityRegistrationSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user_role = User.Role.COMMUNITY

    organisation_name = serializers.CharField(max_length=255)
    org_type = serializers.CharField(max_length=100)
    contact_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=30)
    delivery_address = serializers.CharField(max_length=255)
    postcode = serializers.CharField(max_length=20)

    def create_profile(self, user, profile_data):
        # Community accounts behave as bulk buyers, so their delivery address is
        # stored as the default address used by bulk checkout and near-me lookup.
        delivery_address = profile_data.pop("delivery_address")
        postcode = profile_data.pop("postcode")

        city = _infer_city_from_address(delivery_address)
        address = Address.objects.create(
            user=user,
            label="Delivery Address",
            line1=delivery_address,
            city=city,
            postcode=postcode,
            is_default=True,
        )

        CommunityGroupProfile.objects.create(user=user, delivery_address=address, **profile_data)


class RestaurantRegistrationSerializer(BaseRegistrationSerializer):
    """
    Documents the `RestaurantRegistrationSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    user_role = User.Role.RESTAURANT

    business_name = serializers.CharField(max_length=255)
    contact_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=30)
    delivery_address = serializers.CharField(max_length=255)
    postcode = serializers.CharField(max_length=20)

    def create_profile(self, user, profile_data):
        # Restaurant accounts share the buyer-side address model but route to
        # recurring-order capable checkout screens after login.
        delivery_address = profile_data.pop("delivery_address")
        postcode = profile_data.pop("postcode")

        city = _infer_city_from_address(delivery_address)
        address = Address.objects.create(
            user=user,
            label="Delivery Address",
            line1=delivery_address,
            city=city,
            postcode=postcode,
            is_default=True,
        )

        RestaurantProfile.objects.create(user=user, delivery_address=address, **profile_data)


class LoginSerializer(serializers.Serializer):
    """
    Documents the `LoginSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        remember_me = attrs.get("remember_me", False)
        normalized_email = UserModel.objects.normalize_email(email or "")
        user_record = UserModel.objects.filter(email__iexact=normalized_email).first()

        if user_record is None:
            raise serializers.ValidationError("No account found with that email address.")
        if not user_record.is_active:
            raise serializers.ValidationError("This account is inactive. Please contact support.")

        user = authenticate(self.context.get("request"), username=email, password=password)
        if not user:
            raise serializers.ValidationError("Incorrect password. Please try again.")
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive. Please contact support.")
        attrs["user"] = user
        attrs["remember_me"] = bool(remember_me)
        return attrs


class VerifyEmailSerializer(serializers.Serializer):
    """
    Documents the `VerifyEmailSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    token = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Documents the `PasswordResetRequestSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Documents the `PasswordResetConfirmSerializer` boundary for this module.

    The class belongs to the file role described above: Validates API payloads and converts Django model instances into JSON-friendly response shapes.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)
