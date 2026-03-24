from rest_framework import serializers

from .models import DeliveryJob


class DeliveryJobSerializer(serializers.ModelSerializer):
    eta = serializers.DateTimeField(source="eta_to_dropoff", read_only=True)
    courier = serializers.SerializerMethodField()
    last_coordinates = serializers.SerializerMethodField()
    simulation_started_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = DeliveryJob
        fields = [
            "id",
            "provider",
            "provider_reference",
            "package_reference",
            "client_reference",
            "status",
            "tracking_url",
            "client_tracking_url",
            "eta",
            "courier",
            "last_coordinates",
            "pickup_address_snapshot",
            "dropoff_address_snapshot",
            "quote_amount",
            "quote_currency",
            "last_error",
            "test_mode",
            "simulation_started_at",
            "simulation_duration_seconds",
            "created_at",
            "updated_at",
            "dispatched_at",
            "delivered_at",
            "cancelled_at",
        ]

    def get_courier(self, obj: DeliveryJob) -> dict:
        return {
            "name": obj.courier_name,
            "phone": obj.courier_phone,
            "transport_type": obj.courier_transport_type,
        }

    def get_last_coordinates(self, obj: DeliveryJob) -> dict | None:
        if obj.last_courier_latitude is None or obj.last_courier_longitude is None:
            return None
        return {
            "lat": float(obj.last_courier_latitude),
            "lng": float(obj.last_courier_longitude),
        }
