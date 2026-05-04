"""
DESD Marketplace documentation.

File role:
    Source module for the payments area.

Domain context:
    Payments domain: Stripe checkout, settlement records, commission capture, and payment-service integration.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.payments.services import process_weekly_settlements


class Command(BaseCommand):
    """
    Documents the `Command` boundary for this module.

    The class belongs to the file role described above: Source module for the payments area.
    It keeps related behavior grouped so the payments domain: stripe checkout, settlement records, commission capture, and payment-service integration.
    can be changed without spreading the same responsibility across unrelated files.
    """
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
