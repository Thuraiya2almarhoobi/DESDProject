#!/usr/bin/env python3
"""Print Django database tables, model counts, and sample rows."""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def bootstrap_django() -> None:
    project_root = Path(__file__).resolve().parents[1]
    os.chdir(project_root)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bristol_marketplace.settings")
    os.environ.setdefault("PYTHONPATH", str(project_root))

    import django  # noqa: PLC0415

    django.setup()


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect Django DB tables and model rows.")
    parser.add_argument(
        "--samples",
        type=int,
        default=3,
        help="Number of sample rows to print for each model (default: 3).",
    )
    args = parser.parse_args()

    bootstrap_django()

    from django.apps import apps  # noqa: PLC0415
    from django.db import connection  # noqa: PLC0415

    print("DB_ENGINE:", connection.settings_dict.get("ENGINE"))
    print("DB_NAME:", connection.settings_dict.get("NAME"))
    print("")

    table_names = sorted(connection.introspection.table_names())
    print(f"TABLES (count={len(table_names)}):")
    for table_name in table_names:
        print("-", table_name)

    print("")
    print("APP MODEL COUNTS + SAMPLE ROWS")
    print("================================")

    for model in sorted(apps.get_models(), key=lambda model: (model._meta.app_label, model._meta.model_name)):
        if not model.__module__.startswith("apps."):
            continue

        label = f"{model._meta.app_label}.{model.__name__}"
        table = model._meta.db_table

        try:
            count = model.objects.count()
        except Exception as exc:  # pragma: no cover - diagnostic output only.
            print(f"{label} [{table}] -> ERROR: {exc}")
            continue

        print(f"{label} [{table}] -> {count}")
        if count <= 0:
            continue

        sample_rows = model.objects.order_by("pk")[: args.samples]
        for row in sample_rows:
            print("  -", str(row))

    print("")


if __name__ == "__main__":
    main()
