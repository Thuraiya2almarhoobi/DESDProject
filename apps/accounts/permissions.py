from __future__ import annotations

from rest_framework.permissions import BasePermission

from .models import User


class _BaseRolePermission(BasePermission):
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
    required_role = User.Role.CUSTOMER


class IsProducer(_BaseRolePermission):
    required_role = User.Role.PRODUCER


class IsCommunity(_BaseRolePermission):
    required_role = User.Role.COMMUNITY


class IsRestaurant(_BaseRolePermission):
    required_role = User.Role.RESTAURANT


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role == User.Role.ADMIN or user.is_staff or user.is_superuser
