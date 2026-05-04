"""
DESD Marketplace documentation.

File role:
    Declares the Django application configuration used during startup and app discovery.

Domain context:
    Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from django.apps import AppConfig


class ContentConfig(AppConfig):
    """
    Documents the `ContentConfig` boundary for this module.

    The class belongs to the file role described above: Declares the Django application configuration used during startup and app discovery.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.content'
