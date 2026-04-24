from __future__ import annotations

import json
import os
from typing import Any
from wsgiref.simple_server import make_server

import stripe

"""
Minimal internal Stripe wrapper service.

Why this exists:
- Django talks to this service instead of scattering Stripe SDK calls across
  the main web app
- provider secrets stay inside the payments container boundary
- test-mode validation is centralized in one place
"""


def _response(start_response, status_code: int, payload: dict[str, Any]) -> list[bytes]:
    """Return a small JSON WSGI response without depending on a larger framework."""
    status_text = {
        200: "200 OK",
        201: "201 Created",
        400: "400 Bad Request",
        401: "401 Unauthorized",
        404: "404 Not Found",
        405: "405 Method Not Allowed",
        500: "500 Internal Server Error",
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
    """Reject requests that do not present the shared internal service token."""
    expected = (os.getenv("PAYMENT_SERVICE_SHARED_SECRET", "") or "").strip()
    if not expected:
        return
    provided = (environ.get("HTTP_X_PAYMENT_SERVICE_TOKEN") or "").strip()
    if provided != expected:
        raise PermissionError("Invalid payment service token.")


def _validated_stripe_keys() -> tuple[str, str]:
    """Ensure only configured Stripe test keys are accepted in this environment."""
    secret_key = (os.getenv("STRIPE_SECRET_KEY", "") or "").strip()
    publishable_key = (os.getenv("STRIPE_PUBLISHABLE_KEY", "") or "").strip()

    if not secret_key:
        raise ValueError("Stripe secret key is not configured.")
    if "placeholder_replace_me" in secret_key:
        raise ValueError("Stripe secret key is still a placeholder. Set a real Stripe test secret key before starting Docker.")
    if secret_key.startswith("sk_live_"):
        raise ValueError("Live Stripe keys are not allowed. Use Stripe test keys only.")
    if not secret_key.startswith("sk_test_"):
        raise ValueError("Stripe secret key must be a test mode key.")

    if publishable_key:
        if "placeholder_replace_me" in publishable_key:
            publishable_key = ""
        elif publishable_key.startswith("pk_live_"):
            raise ValueError("Live Stripe keys are not allowed. Use Stripe test keys only.")
        elif not publishable_key.startswith("pk_test_"):
            raise ValueError("Stripe publishable key must be a test mode key.")

    return secret_key, publishable_key


def _validated_webhook_secret() -> str:
    webhook_secret = (os.getenv("STRIPE_WEBHOOK_SECRET", "") or "").strip()
    if not webhook_secret:
        raise ValueError("Stripe webhook secret is not configured.")
    if "placeholder_replace_me" in webhook_secret:
        raise ValueError("Stripe webhook secret is still a placeholder. Set a real Stripe test webhook secret.")
    return webhook_secret


def _configure_stripe() -> str:
    secret_key, publishable_key = _validated_stripe_keys()
    stripe.api_key = secret_key
    return publishable_key


def _stripe_payload(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "to_dict_recursive"):
        return obj.to_dict_recursive()
    raise ValueError("Stripe returned an unsupported object.")


def _handle_create_checkout_session(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Create a hosted Stripe Checkout session for an order prepared by Django."""
    publishable_key = _configure_stripe()
    session = stripe.checkout.Session.create(
        mode="payment",
        client_reference_id=str(body.get("client_reference_id") or ""),
        customer_email=(body.get("customer_email") or None),
        payment_method_types=["card"],
        line_items=body.get("line_items") or [],
        metadata=body.get("metadata") or {},
        payment_intent_data={
            "metadata": body.get("metadata") or {},
        },
        success_url=str(body.get("success_url") or ""),
        cancel_url=str(body.get("cancel_url") or ""),
    )
    session_payload = _stripe_payload(session)
    if bool(session_payload.get("livemode", False)):
        raise ValueError("Stripe Checkout must run in test mode only.")
    return (
        201,
        {
            "id": session_payload.get("id", ""),
            "url": session_payload.get("url", ""),
            "livemode": False,
            "publishable_key": publishable_key,
        },
    )


def _handle_retrieve_checkout_session(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Read back hosted checkout status after the browser returns to the app."""
    _configure_stripe()
    session_id = str(body.get("session_id") or "")
    if not session_id:
        raise ValueError("session_id is required.")
    session = stripe.checkout.Session.retrieve(session_id)
    session_payload = _stripe_payload(session)
    if bool(session_payload.get("livemode", False)):
        raise ValueError("Stripe Checkout must run in test mode only.")
    return (
        200,
        {
            "id": session_payload.get("id", session_id),
            "payment_status": session_payload.get("payment_status", ""),
            "status": session_payload.get("status", ""),
            "payment_intent": session_payload.get("payment_intent", ""),
            "livemode": False,
        },
    )


def _handle_verify_webhook(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Verify a Stripe webhook payload/signature pair for the Django app."""
    _configure_stripe()
    webhook_secret = _validated_webhook_secret()
    payload = str(body.get("payload") or "").encode("utf-8")
    signature = str(body.get("signature") or "")
    if not signature:
        raise ValueError("Stripe-Signature header is required.")
    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=signature, secret=webhook_secret)
    except Exception as exc:
        raise ValueError("Invalid Stripe webhook signature.") from exc
    return 200, {"event": _stripe_payload(event)}


def application(environ, start_response):
    """WSGI entrypoint exposing health, checkout-session, and webhook endpoints."""
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
        if path == "/stripe/checkout-sessions":
            status_code, payload = _handle_create_checkout_session(body)
        elif path == "/stripe/checkout-sessions/retrieve":
            status_code, payload = _handle_retrieve_checkout_session(body)
        elif path == "/stripe/webhooks/verify":
            status_code, payload = _handle_verify_webhook(body)
        else:
            return _response(start_response, 404, {"detail": "Not found."})

        return _response(start_response, status_code, payload)
    except PermissionError as exc:
        return _response(start_response, 401, {"detail": str(exc)})
    except ValueError as exc:
        return _response(start_response, 400, {"detail": str(exc)})
    except stripe.error.StripeError as exc:
        message = str(getattr(exc, "user_message", "") or str(exc) or "Stripe API request failed.")
        return _response(start_response, 502, {"detail": message})
    except Exception:
        return _response(start_response, 500, {"detail": "Stripe payment service failed."})


if __name__ == "__main__":
    port = int(os.getenv("PAYMENT_SERVICE_PORT", "8010"))
    with make_server("0.0.0.0", port, application) as server:
        server.serve_forever()
