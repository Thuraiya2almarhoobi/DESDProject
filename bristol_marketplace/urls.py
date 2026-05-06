"""
DESD Marketplace documentation.

File role:
    Registers project-level URL routes for API apps, Django admin, and frontend fallback pages.

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
URL configuration for bristol_marketplace project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from .views import frontend_app

# Project-level routing split:
# - `/api/...` is handled by Django REST Framework apps
# - `/django-admin/` is the stock Django table admin
# - everything else is sent to the React SPA entrypoint

urlpatterns = [
    # Catalog endpoints are exposed twice so older test contracts and newer
    # namespaced frontend calls both remain valid.
    path("api/", include("apps.catalog.urls")),
    path("api/catalog/", include("apps.catalog.urls")),
    path("api/orders/", include("apps.orders.urls")),
    path("api/community/", include("apps.community.urls")),
    path("api/restaurant/", include("apps.orders.recurring_urls")),
    path("api/admin/", include("apps.orders.admin_report_urls")),
    path("api/producer/", include("apps.producer_portal.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/delivery/", include("apps.delivery.urls")),
    path("api/geo/", include("apps.geo.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/moderation/", include("apps.moderation.urls")),
    path("api/accounts/", include("apps.accounts.urls")),
    # Keep Django's table-based admin on a separate route so /admin/* belongs
    # to the custom React administrator experience.
    path("django-admin/", admin.site.urls),
    # Serve the React/Vite frontend for all non-API application routes,
    # including the custom /admin/* workspace.
    re_path(r"^(?!api/|django-admin/|static/|media/).*$", frontend_app, name="frontend-app"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
