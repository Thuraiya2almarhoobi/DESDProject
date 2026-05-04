"""
DESD Marketplace documentation.

File role:
    Declares the Django application configuration used during startup and app discovery.

Domain context:
    Accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """
    Documents the `AccountsConfig` boundary for this module.

    The class belongs to the file role described above: Declares the Django application configuration used during startup and app discovery.
    It keeps related behavior grouped so the accounts and identity domain: registration, login, role-aware profiles, password reset, email flows, and access-control helpers.
    can be changed without spreading the same responsibility across unrelated files.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.accounts'
