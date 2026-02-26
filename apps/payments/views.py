from __future__ import annotations

import csv

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, response, status
from rest_framework.views import APIView

from .models import WeeklySettlement
from .serializers import WeeklySettlementSerializer
from .services import process_weekly_settlements


class WeeklySettlementListAPIView(generics.ListAPIView):
    serializer_class = WeeklySettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WeeklySettlement.objects.filter(producer=self.request.user).prefetch_related("lines", "lines__order")


class WeeklySettlementDetailAPIView(generics.RetrieveAPIView):
    serializer_class = WeeklySettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WeeklySettlement.objects.filter(producer=self.request.user).prefetch_related("lines", "lines__order")


class WeeklySettlementExportCSVAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int):
        settlement = get_object_or_404(
            WeeklySettlement.objects.prefetch_related("lines", "lines__order"),
            pk=pk,
            producer=request.user,
        )
        csv_response = HttpResponse(content_type="text/csv")
        csv_response["Content-Disposition"] = (
            f'attachment; filename="settlement-{settlement.week_start}-{settlement.week_end}.csv"'
        )
        writer = csv.writer(csv_response)
        writer.writerow(
            [
                "Transaction Reference",
                "Week Start",
                "Week End",
                "Order Number",
                "Customer Name",
                "Gross Amount",
                "Commission (5%)",
                "Net Amount",
                "Status",
            ]
        )
        for line in settlement.lines.all():
            writer.writerow(
                [
                    settlement.transaction_reference,
                    settlement.week_start.isoformat(),
                    settlement.week_end.isoformat(),
                    line.order.order_number,
                    line.customer_name,
                    f"{line.gross_amount:.2f}",
                    f"{line.commission_amount:.2f}",
                    f"{line.net_amount:.2f}",
                    settlement.status,
                ]
            )
        return csv_response


class TriggerWeeklySettlementsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return response.Response({"detail": "Only staff users can trigger settlement runs."}, status=403)

        settlements = process_weekly_settlements()
        payload = WeeklySettlementSerializer(settlements, many=True).data
        return response.Response(
            {"created_count": len(payload), "results": payload},
            status=status.HTTP_201_CREATED,
        )
