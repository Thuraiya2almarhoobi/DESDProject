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
from django.contrib import admin
from django.urls import include, path, re_path

from .views import frontend_app

urlpatterns = [
    # Catalog endpoints preserved at /api/products and /api/categories for existing test/frontend contracts.
    path("api/", include("apps.catalog.urls")),
    path("api/catalog/", include("apps.catalog.urls")),
    path("api/orders/", include("apps.orders.urls")),
    path("api/producer/", include("apps.producer_portal.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/geo/", include("apps.geo.urls")),
    path("api/content/", include("apps.content.urls")),
    # Frontend route that intentionally uses /admin/commission.
    re_path(r"^admin/commission/?$", frontend_app, name="frontend-admin-commission"),
    path("api/accounts/", include("apps.accounts.urls")),
    path('admin/', admin.site.urls),
    # Serve the React/Vite frontend for all application routes.
    re_path(r"^(?!admin/|api/|static/|media/).*$", frontend_app, name="frontend-app"),
]
