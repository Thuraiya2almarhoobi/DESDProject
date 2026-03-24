from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from wsgiref.simple_server import make_server

import requests

TOKEN_CACHE: dict[str, Any] = {
    "access_token": "",
    "expires_at": 0.0,
}


def _response(start_response, status_code: int, payload: dict[str, Any]) -> list[bytes]:
    status_text = {
        200: "200 OK",
        201: "201 Created",
        400: "400 Bad Request",
        401: "401 Unauthorized",
        404: "404 Not Found",
        405: "405 Method Not Allowed",
        500: "500 Internal Server Error",
        502: "502 Bad Gateway",
    }[status_code]
    body = json.dumps(payload).encode("utf-8")
    start_response(
        status_text,
        [
            ("Content-Type", "application/json"),
            ("Content-Length", str(len(body))),
        ],
    )
    return [body]


def _read_json_body(environ) -> dict[str, Any]:
    try:
        length = int(environ.get("CONTENT_LENGTH") or "0")
    except ValueError:
        length = 0
    raw_body = environ["wsgi.input"].read(length or 0)
    if not raw_body:
        return {}
    try:
        return json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("Request body must be valid JSON.") from exc


def _require_service_token(environ) -> None:
    expected = (os.getenv("STUART_SERVICE_SHARED_SECRET", "") or "").strip()
    if not expected:
        return
    provided = (environ.get("HTTP_X_STUART_SERVICE_TOKEN") or "").strip()
    if provided != expected:
        raise PermissionError("Invalid Stuart service token.")


def _base_url() -> str:
    value = (os.getenv("STUART_BASE_URL", "") or "").strip().rstrip("/")
    if not value:
        raise ValueError("Stuart base URL is not configured.")
    return value


def _client_id() -> str:
    value = (os.getenv("STUART_CLIENT_ID", "") or "").strip()
    if not value:
        raise ValueError("Stuart client ID is not configured.")
    return value


def _client_secret() -> str:
    value = (os.getenv("STUART_CLIENT_SECRET", "") or "").strip()
    if not value:
        raise ValueError("Stuart client secret is not configured.")
    return value


def _account_id() -> str:
    return (os.getenv("STUART_ACCOUNT_ID", "") or "").strip()


def _request_timeout() -> int:
    return int(os.getenv("STUART_TIMEOUT_SECONDS", "20"))


def _default_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/json",
    }
    account_id = _account_id()
    if account_id:
        headers["X-Stuart-Account-Id"] = account_id
    return headers


def _oauth_token() -> str:
    if TOKEN_CACHE["access_token"] and float(TOKEN_CACHE["expires_at"]) > time.time() + 60:
        return str(TOKEN_CACHE["access_token"])

    response = requests.post(
        f"{_base_url()}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": _client_id(),
            "client_secret": _client_secret(),
        },
        timeout=_request_timeout(),
    )
    if not response.ok:
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        detail = payload.get("message") if isinstance(payload, dict) else None
        raise ValueError(str(detail or "Unable to authenticate with Stuart."))

    payload = response.json()
    access_token = str(payload.get("access_token") or "")
    expires_in = int(payload.get("expires_in") or 3600)
    if not access_token:
        raise ValueError("Stuart OAuth response did not include an access token.")

    TOKEN_CACHE["access_token"] = access_token
    TOKEN_CACHE["expires_at"] = time.time() + max(300, expires_in)
    return access_token


def _authorized_headers() -> dict[str, str]:
    headers = _default_headers()
    headers["Authorization"] = f"Bearer {_oauth_token()}"
    headers["Content-Type"] = "application/json"
    return headers


def _parse_json_response(response: requests.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    return payload


def _parse_iso_datetime(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return ""


def _split_contact_name(value: str, fallback_lastname: str = "Contact") -> tuple[str, str]:
    parts = [part.strip() for part in (value or "").split() if part.strip()]
    if not parts:
        return "Local", fallback_lastname
    if len(parts) == 1:
        return parts[0], fallback_lastname
    return parts[0], " ".join(parts[1:])


def _extract(path_payload: Any, *paths: tuple[str, ...]) -> Any:
    for path in paths:
        current = path_payload
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


def _normalised_create_payload(body: dict[str, Any]) -> dict[str, Any]:
    pickup = body.get("pickup") or {}
    dropoff = body.get("dropoff") or {}
    if not pickup.get("address"):
        raise ValueError("pickup.address is required.")
    if not dropoff.get("address"):
        raise ValueError("dropoff.address is required.")

    pickup_at = str(body.get("pickup_at") or "").strip()

    pickup_firstname, pickup_lastname = _split_contact_name(str(pickup.get("contact_name") or "Producer"), "Producer")
    dropoff_firstname, dropoff_lastname = _split_contact_name(str(dropoff.get("contact_name") or "Customer"), "Customer")
    metadata = body.get("metadata") or {}
    assignment_code = ""
    if isinstance(metadata, dict):
        assignment_code = str(metadata.get("order_number") or metadata.get("sub_order_id") or "")

    job_payload: dict[str, Any] = {
        "pickups": [
            {
                "address": str(pickup.get("address") or ""),
                "comment": str(pickup.get("comment") or ""),
                "contact": {
                    "firstname": pickup_firstname,
                    "lastname": pickup_lastname,
                    "phone": str(pickup.get("phone") or ""),
                    "company": str(pickup.get("company") or pickup.get("contact_name") or "Producer"),
                },
            }
        ],
        "dropoffs": [
            {
                "address": str(dropoff.get("address") or ""),
                "comment": str(dropoff.get("comment") or ""),
                "client_reference": str(body.get("client_reference") or ""),
                "package_type": str(body.get("package_type") or "medium"),
                "contact": {
                    "firstname": dropoff_firstname,
                    "lastname": dropoff_lastname,
                    "phone": str(dropoff.get("phone") or ""),
                    "company": str(dropoff.get("company") or dropoff.get("contact_name") or "Customer"),
                },
            }
        ],
    }
    if pickup_at:
        job_payload["pickup_at"] = pickup_at
    if assignment_code:
        job_payload["assignment_code"] = assignment_code
    return {"job": job_payload}


def _map_job_payload(payload: dict[str, Any], fallback_client_reference: str = "") -> dict[str, Any]:
    delivery = {}
    deliveries = _extract(payload, ("deliveries",), ("job", "deliveries"), ("details", "deliveries"))
    if isinstance(deliveries, list) and deliveries:
        first_delivery = deliveries[0]
        if isinstance(first_delivery, dict):
            delivery = first_delivery

    package = _extract(payload, ("package",), ("details", "package")) or delivery
    dropoff = _extract(payload, ("dropoff",), ("details", "dropoff")) or {}
    courier = (
        _extract(payload, ("courier",), ("details", "courier"), ("driver",), ("delivery", "driver"))
        or _extract(delivery, ("driver",))
        or {}
    )
    pricing = _extract(payload, ("pricing",), ("job", "pricing")) or {}
    eta = _extract(
        payload,
        ("eta_to_dropoff",),
        ("eta",),
        ("dropoff", "eta"),
        ("dropoff_at",),
    ) or _extract(delivery, ("dropoff_eta",), ("dropoff_at",))
    tracking_url = str(
        _extract(payload, ("tracking_url",), ("dropoff", "tracking_url"))
        or _extract(package, ("tracking_url",))
        or _extract(delivery, ("tracking_url",))
        or ""
    )

    return {
        "job_id": str(_extract(payload, ("id",), ("job", "id"), ("details", "job", "id")) or ""),
        "package_id": str(_extract(package, ("id",)) or _extract(delivery, ("id",)) or ""),
        "client_reference": str(
            _extract(payload, ("client_reference",), ("reference",), ("metadata", "sub_order_id"))
            or _extract(delivery, ("client_reference",))
            or _extract(package, ("reference",))
            or fallback_client_reference
        ),
        "status": str(
            _extract(
                payload,
                ("status",),
                ("event",),
                ("type",),
                ("topic",),
                ("state",),
                ("package", "status"),
            )
            or _extract(delivery, ("status",))
            or "created"
        ),
        "tracking_url": tracking_url,
        "client_tracking_url": str(_extract(dropoff, ("client_tracking_url",)) or tracking_url),
        "eta_to_dropoff": _parse_iso_datetime(eta),
        "courier_name": str(
            _extract(courier, ("name",), ("firstname",))
            or (
                " ".join(
                    part
                    for part in [
                        str(_extract(courier, ("firstname",)) or "").strip(),
                        str(_extract(courier, ("lastname",)) or "").strip(),
                    ]
                    if part
                )
            )
            or ""
        ),
        "courier_phone": str(_extract(courier, ("phone_number",), ("phone",), ("mobile",)) or ""),
        "courier_transport_type": str(_extract(courier, ("transport_type",), ("vehicle_type",)) or ""),
        "quote_amount": str(
            _extract(pricing, ("tax_included",), ("customer_tax_included",), ("amount",))
            or _extract(payload, ("price", "amount"), ("amount",))
            or ""
        ),
        "quote_currency": str(_extract(pricing, ("currency",)) or _extract(payload, ("price", "currency"), ("currency",)) or ""),
        "test_mode": True,
        "raw_payload": payload,
    }


def _stuart_request(method: str, path: str, *, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    response = requests.request(
        method,
        f"{_base_url()}{path}",
        headers=_authorized_headers(),
        json=payload,
        timeout=_request_timeout(),
    )
    response_payload = _parse_json_response(response)
    if not response.ok:
        detail = ""
        for candidate in (
            response_payload.get("message"),
            response_payload.get("detail"),
            response_payload.get("error"),
        ):
            if isinstance(candidate, str) and candidate.strip():
                detail = candidate
                break
        raise ValueError(detail or "Stuart API request failed.")
    return response_payload


def _handle_create_job(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    payload = _normalised_create_payload(body)
    response_payload = _stuart_request("POST", "/v2/jobs", payload=payload)
    return 201, _map_job_payload(response_payload, fallback_client_reference=str(body.get("client_reference") or ""))


def _handle_retrieve_job(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    job_id = str(body.get("job_id") or "")
    if not job_id:
        raise ValueError("job_id is required.")
    response_payload = _stuart_request("GET", f"/v2/jobs/{job_id}")
    return 200, _map_job_payload(response_payload, fallback_client_reference=str(body.get("client_reference") or ""))


def _handle_cancel_job(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    job_id = str(body.get("job_id") or "")
    if not job_id:
        raise ValueError("job_id is required.")
    response_payload = _stuart_request("POST", f"/v2/jobs/{job_id}/cancel", payload={})
    mapped = _map_job_payload(response_payload, fallback_client_reference=str(body.get("client_reference") or ""))
    if not mapped.get("status"):
        mapped["status"] = "cancelled"
    return 200, mapped


def application(environ, start_response):
    method = environ.get("REQUEST_METHOD", "GET").upper()
    path = environ.get("PATH_INFO", "")

    if path == "/health":
        if method != "GET":
            return _response(start_response, 405, {"detail": "Method not allowed."})
        return _response(start_response, 200, {"status": "ok"})

    try:
        _require_service_token(environ)
        if method != "POST":
            return _response(start_response, 405, {"detail": "Method not allowed."})

        body = _read_json_body(environ)
        if path == "/stuart/jobs":
            status_code, payload = _handle_create_job(body)
        elif path == "/stuart/jobs/retrieve":
            status_code, payload = _handle_retrieve_job(body)
        elif path == "/stuart/jobs/cancel":
            status_code, payload = _handle_cancel_job(body)
        else:
            return _response(start_response, 404, {"detail": "Not found."})
        return _response(start_response, status_code, payload)
    except PermissionError as exc:
        return _response(start_response, 401, {"detail": str(exc)})
    except ValueError as exc:
        return _response(start_response, 400, {"detail": str(exc)})
    except requests.RequestException:
        return _response(start_response, 502, {"detail": "Stuart sandbox request failed."})
    except Exception:
        return _response(start_response, 500, {"detail": "Stuart delivery service failed."})


if __name__ == "__main__":
    port = int(os.getenv("STUART_SERVICE_PORT", "8020"))
    with make_server("0.0.0.0", port, application) as server:
        server.serve_forever()
