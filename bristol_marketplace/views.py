"""
DESD Marketplace documentation.

File role:
    Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

Domain context:
    Django project package: global settings, routing, ASGI/WSGI entrypoints, and shared project helpers.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

import json
from pathlib import Path

from django.conf import settings
from django.shortcuts import render


def _load_frontend_assets() -> tuple[str | None, list[str]]:
    """Read Vite's manifest so Django can inject the correct built asset files."""
    manifest_path = Path(settings.FRONTEND_DIST_DIR) / ".vite" / "manifest.json"
    if not manifest_path.exists():
        return None, []

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entry = manifest.get("src/main.tsx") or manifest.get("index.html")
    if not entry:
        return None, []

    js_file = entry.get("file")
    css_files: list[str] = list(entry.get("css", []))

    for imported_chunk in entry.get("imports", []):
        imported = manifest.get(imported_chunk, {})
        for css_file in imported.get("css", []):
            if css_file not in css_files:
                css_files.append(css_file)

    return js_file, css_files


def frontend_app(request):
    """Serve the React SPA shell for any non-API application route."""
    js_file, css_files = _load_frontend_assets()
    return render(
        request,
        "frontend/index.html",
        {
            "frontend_js_file": js_file,
            "frontend_css_files": css_files,
        },
    )
