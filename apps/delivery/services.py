"""
DESD Marketplace documentation.

File role:
    Holds domain/service logic that should stay outside thin HTTP view classes.

Domain context:
    Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from datetime import timedelta
from typing import Any

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.geo.services import get_postcode_coordinates
from apps.orders.models import Order, ProducerSubOrder

from .models import DeliveryEvent, DeliveryJob

TERMINAL_DELIVERY_STATUSES = {
    DeliveryJob.Status.CANCELLED,
    DeliveryJob.Status.DELIVERED,
    DeliveryJob.Status.FAILED,
}


@dataclass(frozen=True)
class StuartDeliveryResult:
    """
    Documents the `StuartDeliveryResult` boundary for this module.

    The class belongs to the file role described above: Holds domain/service logic that should stay outside thin HTTP view classes.
    It keeps related behavior grouped so the delivery domain: delivery jobs, tracking snapshots, stuart/simulation integration, and delivery api endpoints.
    can be changed without spreading the same responsibility across unrelated files.
    """
    delivery_job: DeliveryJob
    created: bool


def _service_base_url() -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_service_base_url` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    base_url = (getattr(settings, "STUART_SERVICE_BASE_URL", "") or "").strip().rstrip("/")
    if not base_url:
        raise ValueError("Stuart delivery service is not configured.")
    return base_url


def _service_headers() -> dict[str, str]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_service_headers` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Stuart credentials live in the delivery microservice. Django authenticates
    # to that service with a shared internal token rather than sending the Stuart
    # client secret from this app.
    headers = {"Content-Type": "application/json"}
    shared_secret = (getattr(settings, "STUART_SERVICE_SHARED_SECRET", "") or "").strip()
    if shared_secret:
        headers["X-Stuart-Service-Token"] = shared_secret
    return headers


def _service_timeout() -> int:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_service_timeout` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    return int(getattr(settings, "STUART_SERVICE_TIMEOUT_SECONDS", 15))


def _simulation_enabled() -> bool:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_simulation_enabled` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    return str(getattr(settings, "DELIVERY_SIMULATION_ENABLED", True)).strip().lower() in {"1", "true", "yes", "on"}


def _simulation_total_seconds() -> int:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_simulation_total_seconds` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    try:
        value = int(getattr(settings, "DELIVERY_SIMULATION_TOTAL_SECONDS", 120))
    except (TypeError, ValueError):
        value = 300
    return max(60, value)


def _service_request(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_service_request` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # All Stuart API calls are proxied through the local delivery service. That
    # gives the marketplace one consistent error surface whether the real Stuart
    # sandbox or the local simulation is being used.
    url = f"{_service_base_url()}{path}"
    try:
        response = requests.post(
            url,
            json=payload,
            headers=_service_headers(),
            timeout=_service_timeout(),
        )
    except requests.RequestException as exc:
        raise ValueError("Stuart delivery service is unavailable.") from exc

    try:
        response_payload = response.json()
    except ValueError:
        response_payload = {}

    if not response.ok:
        detail = response_payload.get("detail") if isinstance(response_payload, dict) else None
        if isinstance(detail, str) and detail.strip():
            raise ValueError(detail)
        raise ValueError("Stuart delivery service request failed.")

    if not isinstance(response_payload, dict):
        raise ValueError("Stuart delivery service returned an invalid response.")
    return response_payload


def _path_lookup(payload: Any, *paths: tuple[str, ...]) -> Any:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_path_lookup` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    for path in paths:
        current = payload
        found = True
        for segment in path:
            if isinstance(current, dict) and segment in current:
                current = current[segment]
            else:
                found = False
                break
        if found and current not in (None, ""):
            return current
    return None


def _normalize_status(raw_status: str | None) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_normalize_status` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Stuart webhooks/service responses use several status names. Normalising
    # them here keeps the frontend tracking timeline stable even if the provider
    # sends `package_delivering`, `in_transit`, or `dropoff` style statuses.
    value = (raw_status or "").strip().lower()
    if not value:
        return DeliveryJob.Status.UNKNOWN
    if any(token == value for token in ("new", "scheduled", "searching", "pending")):
        return DeliveryJob.Status.CREATED
    if any(token == value for token in ("in_progress",)):
        return DeliveryJob.Status.DELIVERING
    if any(token == value for token in ("finished",)):
        return DeliveryJob.Status.DELIVERED
    if any(token == value for token in ("canceled", "expired")):
        return DeliveryJob.Status.CANCELLED if value == "canceled" else DeliveryJob.Status.FAILED
    if any(token in value for token in ("package_delivered", "delivered", "complete", "completed")):
        return DeliveryJob.Status.DELIVERED
    if any(token in value for token in ("package_delivering", "delivering", "dropoff", "in_transit", "transit")):
        return DeliveryJob.Status.DELIVERING
    if any(token in value for token in ("package_picked_up", "picked_up", "picked-up")):
        return DeliveryJob.Status.PICKED_UP
    if any(token in value for token in ("courier_waiting", "waiting_pickup", "waiting_at_pickup")):
        return DeliveryJob.Status.WAITING_PICKUP
    if any(token in value for token in ("picking_up", "picking", "almost_picking", "pickup", "collecting")):
        return DeliveryJob.Status.PICKING_UP
    if any(token in value for token in ("courier_assigned", "assigned")):
        return DeliveryJob.Status.ASSIGNED
    if any(token in value for token in ("package_created", "created")):
        return DeliveryJob.Status.CREATED
    if any(token in value for token in ("cancelled", "canceled")):
        return DeliveryJob.Status.CANCELLED
    if any(token in value for token in ("failed", "failure", "error", "rejected")):
        return DeliveryJob.Status.FAILED
    return DeliveryJob.Status.UNKNOWN


def _parse_decimal(value: Any) -> Decimal | None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_parse_decimal` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def _parse_datetime_value(value: Any):
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_parse_datetime_value` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    if not value or not isinstance(value, str):
        return None
    parsed = parse_datetime(value)
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.utc)
    return parsed


def _quantized_coordinate(value: float) -> Decimal:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_quantized_coordinate` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    return Decimal(str(round(value, 7))).quantize(Decimal("0.0000001"))


def _infer_city_from_address(address_line: str, postcode: str) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_infer_city_from_address` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    parts = [part.strip() for part in (address_line or "").split(",") if part.strip()]
    if len(parts) >= 2:
        candidate = parts[-1]
        if postcode and postcode.lower() in candidate.lower():
            return parts[-2] if len(parts) >= 3 else "Bristol"
        return candidate
    return "Bristol"


def _full_address(line1: str, line2: str, city: str, postcode: str) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_full_address` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    normalized_parts: list[str] = []
    for raw_part in [line1, line2, city, postcode.upper() if postcode else postcode]:
        part = (raw_part or "").strip()
        if not part:
            continue
        if normalized_parts and normalized_parts[-1].lower() == part.lower():
            continue
        normalized_parts.append(part)
    return ", ".join(normalized_parts)


def _enrich_snapshot_with_coordinates(snapshot: dict[str, Any]) -> dict[str, Any]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_enrich_snapshot_with_coordinates` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # The map UI needs coordinates, but order/profile records often store only
    # postcodes. Enrichment keeps original address data while adding map-ready
    # lat/lng when the postcode database/fallback can resolve it.
    enriched = dict(snapshot)
    postcode = str(enriched.get("postcode") or "")
    coordinates = get_postcode_coordinates(postcode)
    if coordinates:
        enriched["coordinates"] = {"lat": coordinates[0], "lng": coordinates[1]}
    return enriched


def _snapshot_coordinates(snapshot: dict[str, Any]) -> tuple[float, float] | None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_snapshot_coordinates` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    if not isinstance(snapshot, dict):
        return None
    coordinates = snapshot.get("coordinates")
    if isinstance(coordinates, dict):
        lat = coordinates.get("lat")
        lng = coordinates.get("lng")
        if lat is not None and lng is not None:
            try:
                return (float(lat), float(lng))
            except (TypeError, ValueError):
                pass

    postcode = str(snapshot.get("postcode") or "")
    return get_postcode_coordinates(postcode)


def _producer_snapshot(sub_order: ProducerSubOrder) -> tuple[dict[str, Any], str, str]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_producer_snapshot` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    from apps.accounts.views import _bootstrap_producer_profile

    producer_user = sub_order.producer.user
    producer_profile = _bootstrap_producer_profile(producer_user) if producer_user else None
    address = producer_profile.address if producer_profile and producer_profile.address else None

    line1 = address.line1 if address else (sub_order.producer.business_name or "Producer Address")
    line2 = address.line2 if address else ""
    city = address.city if address else "Bristol"
    postcode = address.postcode if address else sub_order.producer.postcode
    snapshot = {
        "label": address.label if address else "Business Address",
        "line1": line1,
        "line2": line2,
        "city": city,
        "postcode": postcode,
        "full_address": _full_address(line1, line2, city, postcode),
    }
    contact_name = (
        (producer_profile.contact_name if producer_profile else "") or sub_order.producer.business_name or "Producer"
    )
    phone = (producer_profile.phone if producer_profile else "") or sub_order.producer.phone or ""
    return _enrich_snapshot_with_coordinates(snapshot), contact_name, phone


def _customer_snapshot(sub_order: ProducerSubOrder) -> tuple[dict[str, Any], str, str]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_customer_snapshot` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    from apps.accounts.views import _bootstrap_customer_profile

    order = sub_order.order
    customer_profile = _bootstrap_customer_profile(order.customer) if order.customer_id else None
    full_name = (customer_profile.full_name if customer_profile else "") or "Customer"
    phone = (customer_profile.phone if customer_profile else "") or ""
    address = customer_profile.default_address if customer_profile and customer_profile.default_address else None
    line1 = address.line1 if address else order.delivery_address
    line2 = address.line2 if address else ""
    city = address.city if address else _infer_city_from_address(order.delivery_address, order.customer_postcode)
    postcode = address.postcode if address else order.customer_postcode
    snapshot = {
        "label": "Delivery Address",
        "line1": line1,
        "line2": line2,
        "city": city,
        "postcode": postcode,
        "full_address": _full_address(line1, line2, city, postcode),
    }
    return _enrich_snapshot_with_coordinates(snapshot), full_name, phone


def _client_reference(sub_order: ProducerSubOrder) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_client_reference` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    return f"suborder:{sub_order.id}"


def _build_create_payload(sub_order: ProducerSubOrder) -> dict[str, Any]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_build_create_payload` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    pickup_snapshot, producer_contact_name, producer_phone = _producer_snapshot(sub_order)
    dropoff_snapshot, customer_contact_name, customer_phone = _customer_snapshot(sub_order)

    if not pickup_snapshot["full_address"] or not pickup_snapshot["postcode"]:
        raise ValueError("Producer pickup address is incomplete for Stuart dispatch.")
    if not dropoff_snapshot["full_address"] or not dropoff_snapshot["postcode"]:
        raise ValueError("Customer delivery address is incomplete for Stuart dispatch.")

    return {
        "client_reference": _client_reference(sub_order),
        "pickup": {
            "address": pickup_snapshot["full_address"],
            "postcode": pickup_snapshot["postcode"],
            "city": pickup_snapshot["city"],
            "contact_name": producer_contact_name,
            "phone": producer_phone,
            "comment": f"Pickup for order {sub_order.order.order_number}",
        },
        "dropoff": {
            "address": dropoff_snapshot["full_address"],
            "postcode": dropoff_snapshot["postcode"],
            "city": dropoff_snapshot["city"],
            "contact_name": customer_contact_name,
            "phone": customer_phone,
            "comment": sub_order.order.special_instructions or "",
        },
        "metadata": {
            "order_id": str(sub_order.order_id),
            "sub_order_id": str(sub_order.id),
            "order_number": sub_order.order.order_number,
            "producer_name": sub_order.producer.business_name,
            "customer_email": sub_order.order.customer.email or "",
        },
        "test_mode": True,
    }


def _mark_delivery_job_completed(delivery_job: DeliveryJob) -> None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_mark_delivery_job_completed` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    sub_order = delivery_job.sub_order
    if sub_order.status != Order.Status.DELIVERED:
        sub_order.status = Order.Status.DELIVERED
        sub_order.save(update_fields=["status", "updated_at"])

    from apps.orders.views import _deduct_producer_portal_stock_for_delivery, _sync_parent_order_status

    _deduct_producer_portal_stock_for_delivery(sub_order)
    _sync_parent_order_status(sub_order.order)


def _extract_raw_status(payload: dict[str, Any]) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_extract_raw_status` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    for value in (
        _path_lookup(
            payload,
            ("status",),
            ("state",),
            ("job", "status"),
            ("package", "status"),
            ("details", "package", "status"),
            ("data", "status"),
            ("event",),
            ("type",),
            ("topic",),
        ),
    ):
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _apply_payload_to_delivery_job(delivery_job: DeliveryJob, payload: dict[str, Any]) -> DeliveryJob:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_apply_payload_to_delivery_job` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    raw_status = _extract_raw_status(payload)
    normalized_status = _normalize_status(raw_status)
    tracking_url = _path_lookup(
        payload,
        ("tracking_url",),
        ("package", "tracking_url"),
        ("details", "package", "tracking_url"),
        ("dropoff", "tracking_url"),
    )
    client_tracking_url = _path_lookup(
        payload,
        ("client_tracking_url",),
        ("dropoff", "client_tracking_url"),
        ("details", "dropoff", "client_tracking_url"),
    )
    eta_value = _path_lookup(
        payload,
        ("eta_to_dropoff",),
        ("eta",),
        ("dropoff", "eta"),
        ("details", "dropoff", "eta"),
    )
    courier_name = _path_lookup(payload, ("courier", "name"), ("details", "courier", "name"))
    courier_phone = _path_lookup(payload, ("courier", "phone"), ("details", "courier", "phone_number"))
    transport_type = _path_lookup(
        payload,
        ("courier", "transport_type"),
        ("details", "courier", "transport_type"),
        ("details", "courier", "vehicle_type"),
    )
    latitude = _path_lookup(
        payload,
        ("courier", "lat"),
        ("courier", "latitude"),
        ("courier", "location", "lat"),
        ("details", "courier", "latitude"),
    )
    longitude = _path_lookup(
        payload,
        ("courier", "lng"),
        ("courier", "longitude"),
        ("courier", "location", "lng"),
        ("details", "courier", "longitude"),
    )
    quote_amount = _parse_decimal(
        _path_lookup(payload, ("price", "amount"), ("quote", "amount"), ("amount",))
    )
    quote_currency = str(
        _path_lookup(payload, ("price", "currency"), ("quote", "currency"), ("currency",)) or ""
    )
    package_reference = str(
        _path_lookup(payload, ("package_id",), ("package", "id"), ("details", "package", "id")) or ""
    )
    provider_reference = str(
        _path_lookup(payload, ("job_id",), ("job", "id"), ("details", "job", "id")) or delivery_job.provider_reference
    )
    client_reference = str(
        _path_lookup(
            payload,
            ("client_reference",),
            ("reference",),
            ("package", "reference"),
            ("details", "package", "reference"),
        )
        or delivery_job.client_reference
    )

    if provider_reference:
        delivery_job.provider_reference = provider_reference
    if package_reference:
        delivery_job.package_reference = package_reference
    if client_reference:
        delivery_job.client_reference = client_reference
    if isinstance(tracking_url, str) and tracking_url:
        delivery_job.tracking_url = tracking_url
    if isinstance(client_tracking_url, str) and client_tracking_url:
        delivery_job.client_tracking_url = client_tracking_url
    if not courier_name:
        courier_name = payload.get("courier_name")
    if not courier_phone:
        courier_phone = payload.get("courier_phone")
    if not transport_type:
        transport_type = payload.get("courier_transport_type")

    if isinstance(courier_name, str):
        delivery_job.courier_name = courier_name
    if isinstance(courier_phone, str):
        delivery_job.courier_phone = courier_phone
    if isinstance(transport_type, str):
        delivery_job.courier_transport_type = transport_type
    if latitude not in (None, ""):
        try:
            delivery_job.last_courier_latitude = Decimal(str(latitude))
        except (InvalidOperation, ValueError):
            pass
    if longitude not in (None, ""):
        try:
            delivery_job.last_courier_longitude = Decimal(str(longitude))
        except (InvalidOperation, ValueError):
            pass
    if quote_amount is not None:
        delivery_job.quote_amount = quote_amount
    if quote_currency:
        delivery_job.quote_currency = quote_currency

    parsed_eta = _parse_datetime_value(eta_value)
    if parsed_eta is not None:
        delivery_job.eta_to_dropoff = parsed_eta

    if normalized_status:
        delivery_job.status = normalized_status
        if normalized_status == DeliveryJob.Status.DELIVERED and delivery_job.delivered_at is None:
            delivery_job.delivered_at = timezone.now()
        if normalized_status == DeliveryJob.Status.CANCELLED and delivery_job.cancelled_at is None:
            delivery_job.cancelled_at = timezone.now()

    delivery_job.last_error = ""
    delivery_job.raw_payload = payload
    delivery_job.save(
        update_fields=[
            "provider_reference",
            "package_reference",
            "client_reference",
            "status",
            "tracking_url",
            "client_tracking_url",
            "eta_to_dropoff",
            "courier_name",
            "courier_phone",
            "courier_transport_type",
            "last_courier_latitude",
            "last_courier_longitude",
            "quote_amount",
            "quote_currency",
            "last_error",
            "raw_payload",
            "delivered_at",
            "cancelled_at",
            "updated_at",
        ],
    )
    return delivery_job


def _simulation_status_for_progress(progress: Decimal) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_simulation_status_for_progress` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    if progress >= Decimal("1"):
        return DeliveryJob.Status.DELIVERED
    if progress < Decimal("0.10"):
        return DeliveryJob.Status.ASSIGNED
    if progress < Decimal("0.25"):
        return DeliveryJob.Status.PICKING_UP
    if progress < Decimal("0.40"):
        return DeliveryJob.Status.PICKED_UP
    return DeliveryJob.Status.DELIVERING


def _simulation_delivery_progress(progress: Decimal) -> Decimal:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_simulation_delivery_progress` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    if progress <= Decimal("0.40"):
        return Decimal("0")
    return min(Decimal("1"), max(Decimal("0"), (progress - Decimal("0.40")) / Decimal("0.60")))


def _is_simulation_generated(delivery_job: DeliveryJob) -> bool:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_is_simulation_generated` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    return bool(isinstance(delivery_job.raw_payload, dict) and delivery_job.raw_payload.get("_simulation_generated"))


def _provider_payload_has_coordinates(payload: Any) -> bool:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_provider_payload_has_coordinates` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    return _path_lookup(
        payload,
        ("courier", "lat"),
        ("courier", "latitude"),
        ("courier", "location", "lat"),
        ("details", "courier", "latitude"),
    ) not in (None, "")


def hydrate_delivery_job_snapshots(delivery_job: DeliveryJob) -> DeliveryJob:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `hydrate_delivery_job_snapshots` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Snapshot hydration is safe to run on read: it fills missing coordinates
    # without changing the original address text captured at dispatch time.
    update_fields: list[str] = []
    pickup_snapshot = dict(delivery_job.pickup_address_snapshot or {})
    dropoff_snapshot = dict(delivery_job.dropoff_address_snapshot or {})

    pickup_coordinates = _snapshot_coordinates(pickup_snapshot)
    if pickup_coordinates and "coordinates" not in pickup_snapshot:
        pickup_snapshot["coordinates"] = {"lat": pickup_coordinates[0], "lng": pickup_coordinates[1]}
        delivery_job.pickup_address_snapshot = pickup_snapshot
        update_fields.append("pickup_address_snapshot")

    dropoff_coordinates = _snapshot_coordinates(dropoff_snapshot)
    if dropoff_coordinates and "coordinates" not in dropoff_snapshot:
        dropoff_snapshot["coordinates"] = {"lat": dropoff_coordinates[0], "lng": dropoff_coordinates[1]}
        delivery_job.dropoff_address_snapshot = dropoff_snapshot
        update_fields.append("dropoff_address_snapshot")

    if update_fields:
        update_fields.append("updated_at")
        delivery_job.save(update_fields=update_fields)
    return delivery_job


@transaction.atomic
def sync_delivery_job_simulation(delivery_job: DeliveryJob, now=None) -> DeliveryJob:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `sync_delivery_job_simulation` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # In sandbox mode we generate a realistic courier progression between the
    # producer pickup postcode and buyer dropoff postcode. If Stuart later sends
    # real courier coordinates, provider data wins over simulated coordinates.
    delivery_job = hydrate_delivery_job_snapshots(delivery_job)
    if (
        delivery_job.provider != DeliveryJob.Provider.STUART
        or not delivery_job.test_mode
        or not _simulation_enabled()
        or delivery_job.status in TERMINAL_DELIVERY_STATUSES
        or delivery_job.simulation_started_at is None
        or delivery_job.simulation_duration_seconds <= 0
    ):
        return delivery_job

    current_time = now or timezone.now()
    started_at = delivery_job.simulation_started_at
    total_seconds = max(1, delivery_job.simulation_duration_seconds)
    elapsed_seconds = max(0, int((current_time - started_at).total_seconds()))
    progress = min(Decimal("1"), Decimal(elapsed_seconds) / Decimal(total_seconds))
    simulated_status = _simulation_status_for_progress(progress)
    simulation_completion_at = started_at + timedelta(seconds=total_seconds)

    update_fields = ["status", "eta_to_dropoff", "raw_payload", "updated_at"]
    delivery_job.status = simulated_status
    if simulated_status == DeliveryJob.Status.DELIVERED:
        delivery_job.eta_to_dropoff = current_time
        if delivery_job.delivered_at is None:
            delivery_job.delivered_at = current_time
            update_fields.append("delivered_at")
    else:
        delivery_job.eta_to_dropoff = simulation_completion_at

    if not delivery_job.courier_name:
        delivery_job.courier_name = "Sandbox Rider"
        update_fields.append("courier_name")
    if not delivery_job.courier_transport_type:
        delivery_job.courier_transport_type = "bike"
        update_fields.append("courier_transport_type")

    provider_coordinates_present = (
        delivery_job.last_courier_latitude is not None
        and delivery_job.last_courier_longitude is not None
        and not _is_simulation_generated(delivery_job)
        and _provider_payload_has_coordinates(delivery_job.raw_payload)
    )
    if not provider_coordinates_present:
        pickup_coordinates = _snapshot_coordinates(delivery_job.pickup_address_snapshot or {})
        dropoff_coordinates = _snapshot_coordinates(delivery_job.dropoff_address_snapshot or {})
        if pickup_coordinates and dropoff_coordinates:
            route_progress = _simulation_delivery_progress(progress)
            latitude = pickup_coordinates[0] + ((dropoff_coordinates[0] - pickup_coordinates[0]) * float(route_progress))
            longitude = pickup_coordinates[1] + ((dropoff_coordinates[1] - pickup_coordinates[1]) * float(route_progress))
            if simulated_status in {DeliveryJob.Status.ASSIGNED, DeliveryJob.Status.PICKING_UP, DeliveryJob.Status.PICKED_UP}:
                latitude, longitude = pickup_coordinates
            elif simulated_status == DeliveryJob.Status.DELIVERED:
                latitude, longitude = dropoff_coordinates
            delivery_job.last_courier_latitude = _quantized_coordinate(latitude)
            delivery_job.last_courier_longitude = _quantized_coordinate(longitude)
            update_fields.extend(["last_courier_latitude", "last_courier_longitude"])

    raw_payload = dict(delivery_job.raw_payload or {})
    raw_payload["_simulation_generated"] = True
    raw_payload["_simulation_state"] = {
        "status": simulated_status,
        "progress": float(progress),
        "synced_at": current_time.isoformat(),
    }
    delivery_job.raw_payload = raw_payload
    delivery_job.save(update_fields=list(dict.fromkeys(update_fields)))

    if simulated_status == DeliveryJob.Status.DELIVERED:
        _mark_delivery_job_completed(delivery_job)
    return delivery_job


@transaction.atomic
def restart_delivery_job_simulation(delivery_job: DeliveryJob) -> DeliveryJob:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `restart_delivery_job_simulation` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    if delivery_job.provider != DeliveryJob.Provider.STUART or not delivery_job.test_mode:
        raise ValueError("Simulation restart is only available for Stuart sandbox deliveries.")
    if not _simulation_enabled():
        raise ValueError("Delivery simulation is disabled.")
    if delivery_job.status in TERMINAL_DELIVERY_STATUSES or delivery_job.sub_order.status in {
        Order.Status.DELIVERED,
        Order.Status.CANCELLED,
    }:
        raise ValueError("Simulation restart is not available for delivered or cancelled orders.")

    now = timezone.now()
    delivery_job.simulation_started_at = now
    delivery_job.simulation_duration_seconds = _simulation_total_seconds()
    delivery_job.status = DeliveryJob.Status.ASSIGNED
    delivery_job.eta_to_dropoff = now + timedelta(seconds=delivery_job.simulation_duration_seconds)
    delivery_job.last_courier_latitude = None
    delivery_job.last_courier_longitude = None
    delivery_job.last_error = ""
    delivery_job.raw_payload = {"_simulation_generated": True}
    delivery_job.save(
        update_fields=[
            "simulation_started_at",
            "simulation_duration_seconds",
            "status",
            "eta_to_dropoff",
            "last_courier_latitude",
            "last_courier_longitude",
            "last_error",
            "raw_payload",
            "updated_at",
        ]
    )
    return sync_delivery_job_simulation(delivery_job, now=now)


def latest_delivery_job(sub_order: ProducerSubOrder, *, sync_for_read: bool = False) -> DeliveryJob | None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `latest_delivery_job` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Read paths can request a simulation sync so the UI map appears live even
    # without a real Stuart webhook stream during demos.
    delivery_job = sub_order.delivery_jobs.order_by("-created_at").first()
    if delivery_job is None:
        return None
    if sync_for_read:
        return sync_delivery_job_simulation(delivery_job)
    return hydrate_delivery_job_snapshots(delivery_job)


def active_delivery_job(sub_order: ProducerSubOrder) -> DeliveryJob | None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `active_delivery_job` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    return (
        sub_order.delivery_jobs.exclude(status__in=TERMINAL_DELIVERY_STATUSES)
        .order_by("-created_at")
        .first()
    )


@transaction.atomic
def dispatch_sub_order_to_stuart(sub_order: ProducerSubOrder) -> StuartDeliveryResult:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `dispatch_sub_order_to_stuart` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Each producer sub-order can have only one active courier job at a time.
    # This prevents duplicate delivery bookings for the same supplier/customer
    # leg.
    existing_active = active_delivery_job(sub_order)
    if existing_active is not None:
        raise ValueError("An active Stuart delivery already exists for this producer sub-order.")

    pickup_snapshot, _, _ = _producer_snapshot(sub_order)
    dropoff_snapshot, _, _ = _customer_snapshot(sub_order)
    payload = _build_create_payload(sub_order)
    response_payload = _service_request("/stuart/jobs", payload)
    dispatched_at = timezone.now()
    test_mode = bool(response_payload.get("test_mode", True))
    simulation_started_at = dispatched_at if test_mode and _simulation_enabled() else None
    simulation_duration_seconds = _simulation_total_seconds() if simulation_started_at else 0

    # Persist both provider identifiers and address snapshots. Provider IDs are
    # used for refresh/webhook matching; snapshots preserve the exact pickup and
    # dropoff details used when the courier was booked.
    delivery_job = DeliveryJob.objects.create(
        sub_order=sub_order,
        provider=DeliveryJob.Provider.STUART,
        provider_reference=str(response_payload.get("job_id") or ""),
        package_reference=str(response_payload.get("package_id") or ""),
        client_reference=str(response_payload.get("client_reference") or _client_reference(sub_order)),
        status=_normalize_status(str(response_payload.get("status") or "created")),
        tracking_url=str(response_payload.get("tracking_url") or ""),
        client_tracking_url=str(response_payload.get("client_tracking_url") or ""),
        eta_to_dropoff=_parse_datetime_value(response_payload.get("eta_to_dropoff")),
        courier_name=str(response_payload.get("courier_name") or ""),
        courier_phone=str(response_payload.get("courier_phone") or ""),
        courier_transport_type=str(response_payload.get("courier_transport_type") or ""),
        quote_amount=_parse_decimal(response_payload.get("quote_amount")),
        quote_currency=str(response_payload.get("quote_currency") or ""),
        pickup_address_snapshot=pickup_snapshot,
        dropoff_address_snapshot=dropoff_snapshot,
        test_mode=test_mode,
        raw_payload=response_payload,
        simulation_started_at=simulation_started_at,
        simulation_duration_seconds=simulation_duration_seconds,
        dispatched_at=dispatched_at,
    )
    if simulation_started_at is not None:
        delivery_job = sync_delivery_job_simulation(delivery_job, now=dispatched_at)
    return StuartDeliveryResult(delivery_job=delivery_job, created=True)


@transaction.atomic
def refresh_delivery_job(delivery_job: DeliveryJob) -> DeliveryJob:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `refresh_delivery_job` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Manual refresh is useful when webhooks are delayed: it asks the delivery
    # service for the current Stuart state and applies the same mapper used by
    # webhook updates.
    if not delivery_job.provider_reference:
        raise ValueError("This Stuart delivery does not have a provider reference yet.")
    response_payload = _service_request(
        "/stuart/jobs/retrieve",
        {
            "job_id": delivery_job.provider_reference,
            "package_id": delivery_job.package_reference,
            "client_reference": delivery_job.client_reference,
        },
    )
    updated_job = _apply_payload_to_delivery_job(delivery_job, response_payload)
    if updated_job.status == DeliveryJob.Status.DELIVERED:
        _mark_delivery_job_completed(updated_job)
    return updated_job


@transaction.atomic
def cancel_delivery_job(delivery_job: DeliveryJob) -> DeliveryJob:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `cancel_delivery_job` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    if not delivery_job.provider_reference:
        raise ValueError("This Stuart delivery does not have a provider reference yet.")
    response_payload = _service_request(
        "/stuart/jobs/cancel",
        {
            "job_id": delivery_job.provider_reference,
            "package_id": delivery_job.package_reference,
            "client_reference": delivery_job.client_reference,
        },
    )
    return _apply_payload_to_delivery_job(delivery_job, response_payload)


def _extract_event_type(payload: dict[str, Any]) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_extract_event_type` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    value = _path_lookup(payload, ("event",), ("type",), ("topic",))
    return str(value or "")


def _extract_provider_event_id(payload: dict[str, Any]) -> str:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_extract_provider_event_id` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    value = _path_lookup(payload, ("event_id",), ("details", "event", "id"), ("id",))
    return str(value or "")


def _resolve_delivery_job_for_payload(payload: dict[str, Any]) -> DeliveryJob | None:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `_resolve_delivery_job_for_payload` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Stuart payload shapes can vary by event. Try our own client reference
    # first, then package id, then job id, from most stable to most provider-led.
    client_reference = str(
        _path_lookup(
            payload,
            ("client_reference",),
            ("reference",),
            ("package", "reference"),
            ("details", "package", "reference"),
        )
        or ""
    )
    if client_reference:
        match = DeliveryJob.objects.filter(client_reference=client_reference).order_by("-created_at").first()
        if match:
            return match

    package_reference = str(
        _path_lookup(payload, ("package_id",), ("package", "id"), ("details", "package", "id")) or ""
    )
    if package_reference:
        match = DeliveryJob.objects.filter(package_reference=package_reference).order_by("-created_at").first()
        if match:
            return match

    provider_reference = str(
        _path_lookup(payload, ("job_id",), ("job", "id"), ("details", "job", "id")) or ""
    )
    if provider_reference:
        return DeliveryJob.objects.filter(provider_reference=provider_reference).order_by("-created_at").first()
    return None


@transaction.atomic
def handle_stuart_webhook_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Helper for the file role: Holds domain/service logic that should stay outside thin HTTP view classes.

    `handle_stuart_webhook_payload` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Delivery domain: delivery jobs, tracking snapshots, Stuart/simulation integration, and delivery API endpoints.
    """
    # Webhooks are idempotent by provider_event_id so retries update the delivery
    # once and then return a duplicate marker.
    delivery_job = _resolve_delivery_job_for_payload(payload)
    if delivery_job is None:
        raise ValueError("No matching Stuart delivery job was found for this webhook event.")

    provider_event_id = _extract_provider_event_id(payload)
    if provider_event_id:
        duplicate = DeliveryEvent.objects.filter(
            delivery_job=delivery_job,
            provider_event_id=provider_event_id,
        ).exists()
        if duplicate:
            return {
                "delivery_job_id": delivery_job.id,
                "status": delivery_job.status,
                "duplicate": True,
            }

    updated_job = _apply_payload_to_delivery_job(delivery_job, payload)
    normalized_status = _normalize_status(_extract_raw_status(payload))
    DeliveryEvent.objects.create(
        delivery_job=updated_job,
        provider_event_id=provider_event_id,
        event_type=_extract_event_type(payload),
        normalized_status=normalized_status,
        raw_payload=payload,
    )

    if normalized_status == DeliveryJob.Status.DELIVERED:
        _mark_delivery_job_completed(updated_job)

    return {
        "delivery_job_id": updated_job.id,
        "status": updated_job.status,
        "duplicate": False,
    }
