from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.urls import reverse
from django.test import override_settings
import re
from urllib.parse import unquote
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .auth_tokens import generate_password_reset_token
from .models import (
    Address,
    CommunityGroupProfile,
    CustomerProfile,
    LoginAttempt,
    ProducerProfile,
    RestaurantProfile,
    User,
)

UserModel = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://localhost:5173",
)
class AccountsRegistrationTests(APITestCase):
    def setUp(self):
        super().setUp()
        mail.outbox = []

    def _assert_profile_for_role(self, user, role):
        self.assertEqual(CustomerProfile.objects.filter(user=user).exists(), role == User.Role.CUSTOMER)
        self.assertEqual(ProducerProfile.objects.filter(user=user).exists(), role == User.Role.PRODUCER)
        self.assertEqual(CommunityGroupProfile.objects.filter(user=user).exists(), role == User.Role.COMMUNITY)
        self.assertEqual(RestaurantProfile.objects.filter(user=user).exists(), role == User.Role.RESTAURANT)

    def test_registration_creates_expected_role_and_profile(self):
        cases = [
            (
                reverse("register-customer"),
                {
                    "email": "customer1@example.com",
                    "password": "StrongPass123!",
                    "confirm_password": "StrongPass123!",
                    "full_name": "Customer One",
                    "phone": "07111111111",
                    "delivery_address": "45 Park Street, Bristol",
                    "postcode": "BS1 5JG",
                    "accept_terms": True,
                },
                User.Role.CUSTOMER,
            ),
            (
                reverse("register-producer"),
                {
                    "email": "producer1@example.com",
                    "password": "StrongPass123!",
                    "confirm_password": "StrongPass123!",
                    "business_name": "Farm Co",
                    "contact_name": "Jane Smith",
                    "phone": "07222222222",
                    "business_address": "Unit 3, Farm Road, Bristol",
                    "postcode": "BS1 4DJ",
                },
                User.Role.PRODUCER,
            ),
            (
                reverse("register-community"),
                {
                    "email": "community1@example.com",
                    "password": "StrongPass123!",
                    "confirm_password": "StrongPass123!",
                    "organisation_name": "Community Pantry",
                    "org_type": "Charity",
                    "contact_name": "Alice Lead",
                    "phone": "07333333333",
                },
                User.Role.COMMUNITY,
            ),
            (
                reverse("register-restaurant"),
                {
                    "email": "restaurant1@example.com",
                    "password": "StrongPass123!",
                    "confirm_password": "StrongPass123!",
                    "business_name": "Green Bistro",
                    "contact_name": "Bob Chef",
                    "phone": "07444444444",
                },
                User.Role.RESTAURANT,
            ),
        ]

        for endpoint, payload, expected_role in cases:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(endpoint, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertEqual(
                    response.data.get("detail"),
                    "Registration successful, check your email to verify.",
                )

                user = UserModel.objects.get(email=payload["email"])
                self.assertEqual(user.role, expected_role)
                self.assertTrue(user.check_password(payload["password"]))
                self.assertNotEqual(user.password, payload["password"])
                self.assertFalse(user.email_verified)
                self._assert_profile_for_role(user, expected_role)

                self.assertIn("access", response.data)
                self.assertIn("refresh", response.data)
                self.assertEqual(response.data["user"]["role"], expected_role)
                self.assertEqual(response.data["user"]["email_verified"], False)

                if expected_role == User.Role.CUSTOMER:
                    profile = CustomerProfile.objects.get(user=user)
                    self.assertIsNotNone(profile.default_address)
                    self.assertEqual(profile.default_address.postcode, payload["postcode"])

                if expected_role == User.Role.PRODUCER:
                    profile = ProducerProfile.objects.get(user=user)
                    self.assertEqual(profile.contact_name, payload["contact_name"])
                    self.assertIsNotNone(profile.address)
                    self.assertEqual(profile.address.postcode, payload["postcode"])
                    self.assertEqual(profile.lead_time_hours, 48)

        self.assertEqual(len(mail.outbox), len(cases))
        self.assertIn("/verify-email?token=", mail.outbox[-1].body)

    def test_customer_registration_requires_terms_acceptance(self):
        response = self.client.post(
            reverse("register-customer"),
            {
                "email": "no-terms@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "full_name": "No Terms",
                "phone": "07111110000",
                "delivery_address": "45 Park Street, Bristol",
                "postcode": "BS1 5JG",
                "accept_terms": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("accept_terms", response.data)

    def test_producer_registration_defaults_lead_time_when_not_provided(self):
        response = self.client.post(
            reverse("register-producer"),
            {
                "email": "producer-defaults@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "business_name": "Producer Default Farm",
                "contact_name": "Default Contact",
                "phone": "07222229999",
                "business_address": "Unit 9, Market Lane, Bristol",
                "postcode": "BS1 1AA",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile = ProducerProfile.objects.get(user__email="producer-defaults@example.com")
        self.assertEqual(profile.lead_time_hours, 48)

    def test_registration_rejects_weak_password(self):
        response = self.client.post(
            reverse("register-customer"),
            {
                "email": "weak-password@example.com",
                "password": "123456",
                "confirm_password": "123456",
                "full_name": "Weak Password User",
                "phone": "07111110001",
                "delivery_address": "45 Park Street, Bristol",
                "postcode": "BS1 5JG",
                "accept_terms": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertIn("uppercase", " ".join(response.data["password"]).lower())

    def test_registration_accepts_strong_password(self):
        response = self.client.post(
            reverse("register-customer"),
            {
                "email": "strong-password@example.com",
                "password": "VeryStrongPass#2026",
                "confirm_password": "VeryStrongPass#2026",
                "full_name": "Strong Password User",
                "phone": "07111119999",
                "delivery_address": "45 Park Street, Bristol",
                "postcode": "BS1 5JG",
                "accept_terms": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = UserModel.objects.get(email="strong-password@example.com")
        self.assertTrue(user.check_password("VeryStrongPass#2026"))

    def test_customer_registration_requires_full_name(self):
        response = self.client.post(
            reverse("register-customer"),
            {
                "email": "missing-name@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "full_name": "",
                "phone": "07111110002",
                "delivery_address": "45 Park Street, Bristol",
                "postcode": "BS1 5JG",
                "accept_terms": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("full_name", response.data)

    def test_registration_rejects_password_mismatch(self):
        response = self.client.post(
            reverse("register-producer"),
            {
                "email": "producer-mismatch@example.com",
                "password": "StrongPass123!",
                "confirm_password": "DifferentPass123!",
                "business_name": "Farm Co",
                "contact_name": "Jane Smith",
                "phone": "07222222222",
                "business_address": "Unit 3, Farm Road, Bristol",
                "postcode": "BS1 4DJ",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_password", response.data)


class AccountsLoginTests(APITestCase):
    def test_wrong_password_returns_generic_invalid_credentials(self):
        UserModel.objects.create_user(
            email="login-user@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )

        response = self.client.post(
            reverse("auth-login"),
            {"email": "login-user@example.com", "password": "WrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get("detail"), "Invalid credentials")

    def test_remember_me_issues_longer_refresh_lifetime(self):
        from datetime import timedelta

        UserModel.objects.create_user(
            email="remember@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )

        with self.settings(
            JWT_DEFAULT_REFRESH_LIFETIME=timedelta(days=1),
            JWT_REMEMBER_ME_REFRESH_LIFETIME=timedelta(days=30),
        ):
            normal = self.client.post(
                reverse("auth-login"),
                {"email": "remember@example.com", "password": "StrongPass123!", "remember_me": False},
                format="json",
            )
            remembered = self.client.post(
                reverse("auth-login"),
                {"email": "remember@example.com", "password": "StrongPass123!", "remember_me": True},
                format="json",
            )

        self.assertEqual(normal.status_code, status.HTTP_200_OK)
        self.assertEqual(remembered.status_code, status.HTTP_200_OK)

        normal_refresh = RefreshToken(normal.data["refresh"])
        remember_refresh = RefreshToken(remembered.data["refresh"])

        normal_lifetime_seconds = int(normal_refresh["exp"]) - int(normal_refresh["iat"])
        remember_lifetime_seconds = int(remember_refresh["exp"]) - int(remember_refresh["iat"])
        self.assertGreater(remember_lifetime_seconds, normal_lifetime_seconds)

    def test_failed_login_creates_login_attempt_record(self):
        UserModel.objects.create_user(
            email="attempts@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )

        response = self.client.post(
            reverse("auth-login"),
            {"email": "attempts@example.com", "password": "WrongPass123!"},
            format="json",
            REMOTE_ADDR="203.0.113.7",
            HTTP_USER_AGENT="UnitTestAgent/1.0",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        attempt = LoginAttempt.objects.get(email="attempts@example.com")
        self.assertFalse(attempt.success)
        self.assertEqual(attempt.ip_address, "203.0.113.7")
        self.assertEqual(attempt.reason, "invalid_password")


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://localhost:5173",
)
class AccountsVerificationAndPasswordResetTests(APITestCase):
    def setUp(self):
        super().setUp()
        mail.outbox = []

    def test_verify_email_endpoint_marks_email_verified(self):
        response = self.client.post(
            reverse("register-customer"),
            {
                "email": "verify-me@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "full_name": "Verify Me",
                "phone": "07000000001",
                "delivery_address": "1 Test Street, Bristol",
                "postcode": "BS1 1AA",
                "accept_terms": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)

        body = mail.outbox[0].body
        token_match = re.search(r"token=([^\s]+)", body)
        self.assertIsNotNone(token_match)
        token = unquote(token_match.group(1))

        verify_response = self.client.post(
            reverse("auth-verify-email"),
            {"token": token},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)

        user = UserModel.objects.get(email="verify-me@example.com")
        self.assertTrue(user.email_verified)

    def test_password_reset_request_is_generic_for_unknown_email(self):
        response = self.client.post(
            reverse("auth-password-reset-request"),
            {"email": "unknown@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "If the email exists, a reset link has been sent.")
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_confirm_updates_password_and_allows_login(self):
        user = UserModel.objects.create_user(
            email="reset-user@example.com",
            password="OldPassword123!",
            role=User.Role.CUSTOMER,
        )
        token = generate_password_reset_token(user)

        reset_response = self.client.post(
            reverse("auth-password-reset-confirm"),
            {"token": token, "new_password": "NewPassword123!"},
            format="json",
        )
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reset_response.data["detail"], "Password reset successful. Please log in.")

        user.refresh_from_db()
        self.assertTrue(user.check_password("NewPassword123!"))

        login_response = self.client.post(
            reverse("auth-login"),
            {"email": "reset-user@example.com", "password": "NewPassword123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)


class AccountsSecurityThrottleTests(APITestCase):
    def setUp(self):
        from .views import LoginAnonThrottle, LoginUserThrottle

        cache.clear()
        self._login_anon_original_rates = dict(LoginAnonThrottle.THROTTLE_RATES)
        self._login_user_original_rates = dict(LoginUserThrottle.THROTTLE_RATES)
        LoginAnonThrottle.THROTTLE_RATES["login_anon"] = "2/minute"
        LoginUserThrottle.THROTTLE_RATES["login_user"] = "30/minute"

        self.login_url = reverse("auth-login")
        UserModel.objects.create_user(
            email="throttle-user@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )

    def tearDown(self):
        from .views import LoginAnonThrottle, LoginUserThrottle

        LoginAnonThrottle.THROTTLE_RATES = self._login_anon_original_rates
        LoginUserThrottle.THROTTLE_RATES = self._login_user_original_rates
        cache.clear()

    def test_login_throttling_blocks_excessive_attempts(self):
        for _ in range(2):
            response = self.client.post(
                self.login_url,
                {"email": "throttle-user@example.com", "password": "WrongPass123!"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        blocked = self.client.post(
            self.login_url,
            {"email": "throttle-user@example.com", "password": "WrongPass123!"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class AccountsAuthorizationTests(APITestCase):
    def _auth_as(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_unauthorized_requests_cannot_access_me_or_addresses(self):
        me_response = self.client.get(reverse("accounts-me"))
        addresses_response = self.client.get(reverse("accounts-addresses"))

        self.assertEqual(me_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(addresses_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_role_only_endpoint_enforces_rbac(self):
        customer = UserModel.objects.create_user(
            email="customer-role@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )
        CustomerProfile.objects.create(
            user=customer,
            full_name="Role Customer",
            phone="07000000000",
            allergies_text="",
            preferences_text="",
        )

        self._auth_as(customer)
        allowed_response = self.client.get(reverse("customer-only"))
        denied_response = self.client.get(reverse("producer-only"))

        self.assertEqual(allowed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(denied_response.status_code, status.HTTP_403_FORBIDDEN)


class AccountsAddressOwnershipTests(APITestCase):
    def _auth_as(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def setUp(self):
        self.owner = UserModel.objects.create_user(
            email="owner@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )
        self.other_user = UserModel.objects.create_user(
            email="other@example.com",
            password="StrongPass123!",
            role=User.Role.CUSTOMER,
        )

        CustomerProfile.objects.create(
            user=self.owner,
            full_name="Owner",
            phone="07001111111",
            allergies_text="",
            preferences_text="",
        )
        CustomerProfile.objects.create(
            user=self.other_user,
            full_name="Other",
            phone="07002222222",
            allergies_text="",
            preferences_text="",
        )

        self.owner_address = Address.objects.create(
            user=self.owner,
            label="Home",
            line1="1 Owner Street",
            line2="",
            city="Bristol",
            postcode="BS1 1AA",
            is_default=True,
        )

    def test_address_endpoint_enforces_ownership(self):
        self._auth_as(self.other_user)

        patch_response = self.client.patch(
            reverse("accounts-address-detail", kwargs={"pk": self.owner_address.id}),
            {"city": "Not Allowed"},
            format="json",
        )
        delete_response = self.client.delete(
            reverse("accounts-address-detail", kwargs={"pk": self.owner_address.id})
        )

        self.assertEqual(patch_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_profile_address_fk_must_belong_to_authenticated_user(self):
        self._auth_as(self.other_user)

        response = self.client.patch(
            reverse("accounts-me"),
            {"default_address": self.owner_address.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("default_address", response.data)

    def test_setting_new_default_address_unsets_previous_default(self):
        self._auth_as(self.owner)

        create_response = self.client.post(
            reverse("accounts-addresses"),
            {
                "label": "Office",
                "line1": "2 Owner Street",
                "line2": "",
                "city": "Bristol",
                "postcode": "BS1 2BB",
                "is_default": True,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.owner_address.refresh_from_db()
        new_address = Address.objects.get(pk=create_response.data["id"])

        self.assertFalse(self.owner_address.is_default)
        self.assertTrue(new_address.is_default)
