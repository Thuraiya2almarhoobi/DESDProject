"""
DESD Marketplace documentation.

File role:
    Source module for the bristol_marketplace area.

Domain context:
    Django project package: global settings, routing, ASGI/WSGI entrypoints, and shared project helpers.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

"""
WSGI config for bristol_marketplace project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bristol_marketplace.settings')

application = get_wsgi_application()
