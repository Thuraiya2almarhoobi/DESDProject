from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.orders.recurring_services import generate_due_recurring_orders


class Command(BaseCommand):
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
