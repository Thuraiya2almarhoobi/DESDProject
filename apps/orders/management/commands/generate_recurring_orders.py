"""
DESD Marketplace documentation.

File role:
    Source module for the orders area.

Domain context:
    Ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.orders.recurring_services import generate_due_recurring_orders


class Command(BaseCommand):
    """
    Documents the `Command` boundary for this module.

    The class belongs to the file role described above: Source module for the orders area.
    It keeps related behavior grouped so the ordering domain: carts, checkout, order creation, recurring orders, bulk buyer flows, commission reporting, and demo data.
    can be changed without spreading the same responsibility across unrelated files.
    """
    help = "Generate due recurring restaurant orders."

    def add_arguments(self, parser):
        parser.add_argument(
            "--run-date",
            dest="run_date",
            help="Optional run date in YYYY-MM-DD format (defaults to today).",
        )

    def handle(self, *args, **options):
        run_date_raw = options.get("run_date")
        run_date = None
        if run_date_raw:
            try:
                run_date = date.fromisoformat(run_date_raw)
            except ValueError as exc:
                raise CommandError("--run-date must be in YYYY-MM-DD format.") from exc

        results = generate_due_recurring_orders(run_date=run_date)
        generated_count = len([result for result in results if result.order_id is not None])
        skipped_count = len(results) - generated_count

        self.stdout.write(
            self.style.SUCCESS(
                f"Recurring run completed. Generated: {generated_count}, skipped: {skipped_count}."
            )
        )
        for result in results:
            self.stdout.write(
                f"- template={result.template_id} scheduled={result.scheduled_order_date} "
                f"order_id={result.order_id or 'none'} unavailable={len(result.unavailable_products)}"
            )
