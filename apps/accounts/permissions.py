"""
DESD Marketplace documentation.

File role:
    Contains reusable authorization checks used by API views to protect role-specific functionality.

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

from rest_framework.permissions import BasePermission

from .models import User


class _BaseRolePermission(BasePermission):
    """Shared base class for simple single-role DRF permission checks."""

    required_role: str | None = None

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and self.required_role is not None
            and user.role == self.required_role
        )


class IsCustomer(_BaseRolePermission):
    """Allow access only to authenticated customer accounts."""

    required_role = User.Role.CUSTOMER


class IsProducer(_BaseRolePermission):
    """Allow access only to authenticated producer accounts."""

    required_role = User.Role.PRODUCER


class IsCommunity(_BaseRolePermission):
    """Allow access only to authenticated community accounts."""

    required_role = User.Role.COMMUNITY


class IsRestaurant(_BaseRolePermission):
    """Allow access only to authenticated restaurant accounts."""

    required_role = User.Role.RESTAURANT


class IsAdmin(BasePermission):
    """Allow access to admin-role users and Django staff/superusers."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role == User.Role.ADMIN or user.is_staff or user.is_superuser
