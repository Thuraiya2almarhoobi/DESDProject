from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.payments.services import process_weekly_settlements


class Command(BaseCommand):
    help = "Generate weekly producer settlements for the previous week."

    def handle(self, *args, **options):
        settlements = process_weekly_settlements()
        self.stdout.write(
            self.style.SUCCESS(f"Weekly settlements generated: {len(settlements)}")
        )
        for settlement in settlements:
            self.stdout.write(
                f"- Producer {settlement.producer_id} | {settlement.week_start}..{settlement.week_end} "
                f"| gross={settlement.gross_amount} commission={settlement.commission_amount} "
                f"net={settlement.net_amount} ref={settlement.transaction_reference}"
            )
