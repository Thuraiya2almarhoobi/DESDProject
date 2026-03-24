import os
import unittest
from unittest.mock import patch

from stuart_service import server


class FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


class StuartServiceTests(unittest.TestCase):
    def setUp(self):
        server.TOKEN_CACHE["access_token"] = ""
        server.TOKEN_CACHE["expires_at"] = 0.0
        self.env_patcher = patch.dict(
            os.environ,
            {
                "STUART_BASE_URL": "https://api.sandbox.stuart.com",
                "STUART_CLIENT_ID": "client-id",
                "STUART_CLIENT_SECRET": "client-secret",
                "STUART_ACCOUNT_ID": "460934",
                "STUART_SERVICE_SHARED_SECRET": "svc-secret",
                "STUART_TIMEOUT_SECONDS": "20",
            },
            clear=False,
        )
        self.env_patcher.start()
        self.addCleanup(self.env_patcher.stop)

    @patch("stuart_service.server.requests.post")
    def test_oauth_token_is_cached(self, mock_post):
        mock_post.return_value = FakeResponse(200, {"access_token": "oauth-token", "expires_in": 1800})

        first = server._oauth_token()
        second = server._oauth_token()

        self.assertEqual(first, "oauth-token")
        self.assertEqual(second, "oauth-token")
        self.assertEqual(mock_post.call_count, 1)

    @patch("stuart_service.server.requests.post")
    @patch("stuart_service.server.requests.request")
    def test_create_job_normalises_request_and_maps_response(self, mock_request, mock_post):
        mock_post.return_value = FakeResponse(200, {"access_token": "oauth-token", "expires_in": 1800})
        mock_request.return_value = FakeResponse(
            201,
            {
                "id": "job_123",
                "client_reference": "suborder:55",
                "status": "searching_courier",
                "package": {"id": "pkg_123", "tracking_url": "https://tracking.stuart.test/pkg_123"},
                "dropoff": {"client_tracking_url": "https://client.stuart.test/pkg_123"},
                "courier": {"name": "Jordan Rider", "phone_number": "07000000000", "transport_type": "bike"},
                "eta_to_dropoff": "2026-03-24T14:00:00Z",
                "price": {"amount": "6.25", "currency": "GBP"},
            },
        )

        status_code, payload = server._handle_create_job(
            {
                "client_reference": "suborder:55",
                "pickup": {
                    "address": "Unit 5 Farm Lane, Bristol, BS1 4DJ",
                    "contact_name": "Producer",
                    "phone": "07000000001",
                },
                "dropoff": {
                    "address": "45 Park Street, Bristol, BS1 5JG",
                    "contact_name": "Customer",
                    "phone": "07123456789",
                },
                "metadata": {"customer_email": "customer@example.com"},
            }
        )

        self.assertEqual(status_code, 201)
        self.assertEqual(payload["job_id"], "job_123")
        self.assertEqual(payload["package_id"], "pkg_123")
        self.assertEqual(payload["client_reference"], "suborder:55")
        self.assertEqual(payload["courier_name"], "Jordan Rider")
        self.assertEqual(payload["client_tracking_url"], "https://client.stuart.test/pkg_123")

        request_json = mock_request.call_args.kwargs["json"]
        self.assertEqual(request_json["job"]["pickups"][0]["address"], "Unit 5 Farm Lane, Bristol, BS1 4DJ")
        self.assertEqual(request_json["job"]["dropoffs"][0]["address"], "45 Park Street, Bristol, BS1 5JG")
        self.assertEqual(request_json["job"]["dropoffs"][0]["client_reference"], "suborder:55")
        self.assertEqual(request_json["job"]["dropoffs"][0]["package_type"], "medium")

    @patch("stuart_service.server.requests.post")
    @patch("stuart_service.server.requests.request")
    def test_retrieve_job_requests_expected_path(self, mock_request, mock_post):
        mock_post.return_value = FakeResponse(200, {"access_token": "oauth-token", "expires_in": 1800})
        mock_request.return_value = FakeResponse(200, {"id": "job_456", "status": "delivering"})

        status_code, payload = server._handle_retrieve_job({"job_id": "job_456", "client_reference": "suborder:99"})

        self.assertEqual(status_code, 200)
        self.assertEqual(payload["job_id"], "job_456")
        self.assertEqual(payload["status"], "delivering")
        self.assertEqual(mock_request.call_args.args[0], "GET")
        self.assertEqual(mock_request.call_args.args[1], "https://api.sandbox.stuart.com/v2/jobs/job_456")

    @patch("stuart_service.server.requests.post")
    @patch("stuart_service.server.requests.request")
    def test_cancel_job_maps_terminal_state(self, mock_request, mock_post):
        mock_post.return_value = FakeResponse(200, {"access_token": "oauth-token", "expires_in": 1800})
        mock_request.return_value = FakeResponse(200, {"id": "job_789", "status": "cancelled"})

        status_code, payload = server._handle_cancel_job({"job_id": "job_789"})

        self.assertEqual(status_code, 200)
        self.assertEqual(payload["status"], "cancelled")
        self.assertEqual(mock_request.call_args.args[0], "POST")
        self.assertEqual(mock_request.call_args.args[1], "https://api.sandbox.stuart.com/v2/jobs/job_789/cancel")

    @patch("stuart_service.server.requests.post")
    @patch("stuart_service.server.requests.request")
    def test_provider_error_is_normalised(self, mock_request, mock_post):
        mock_post.return_value = FakeResponse(200, {"access_token": "oauth-token", "expires_in": 1800})
        mock_request.return_value = FakeResponse(422, {"message": "Pickup address is invalid."})

        with self.assertRaises(ValueError) as exc:
            server._stuart_request("POST", "/v2/jobs", payload={})

        self.assertEqual(str(exc.exception), "Pickup address is invalid.")


if __name__ == "__main__":
    unittest.main()
