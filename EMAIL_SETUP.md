## Email Confirmation and Password Reset Setup

This project supports two email paths:

1. Demo/dummy email path: the user is saved in the database, but no email is sent for suppressed dummy addresses such as `example.com`, `localfood.test`, `localhost`, or addresses like `dummy@...`.
2. Real email path: when SMTP is configured, registration verification and password reset links are sent to real inboxes.

### 1) Create `.env` at project root

Use this as a starting point:

```env
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,0.0.0.0
FRONTEND_URL=http://127.0.0.1:8000

# PostgreSQL (docker-compose db service)
POSTGRES_DB=bristol_marketplace
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Demo/dummy emails are saved but do not receive outbound mail.
ACCOUNT_EMAIL_SUPPRESS_DOMAINS=example.com,example.org,example.net,invalid,localhost,local,localfood.test,test
ACCOUNT_EMAIL_SUPPRESS_LOCAL_PARTS=dummy,example,fake,test

# Real email mode
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
EMAIL_USE_TLS=true
EMAIL_USE_SSL=false
DEFAULT_FROM_EMAIL=your_email@gmail.com
```

Notes:
- For Gmail, use an app password, not your normal account password.
- If SMTP values are incomplete, the backend automatically falls back to console mode.
- Password reset requests always return a generic success message so attackers cannot discover which emails exist.
- To test the real email path, register or request password reset with an address that is not in the suppress lists.

### 2) Rebuild and run

```bash
docker compose down
docker compose up --build -d
```

### 3) Verify emails are being sent

Tail backend logs:

```bash
docker compose logs -f web
```

In console mode, email content appears in the logs. In SMTP mode with valid credentials, emails are delivered to the recipient inbox.

### 4) Features available

- Registration creates the user and sends a verification email for real addresses.
- Registration creates the user and skips outbound mail for dummy/demo addresses.
- Login page has forgot password support.
- Password reset request sends a reset link for real registered addresses.
- Reset page updates the password with backend validation.