## Email Confirmation and Password Reset Setup

This project supports two email modes:

1. Console mode (dev/demo): emails are printed in backend logs.
2. SMTP mode (real email): emails are sent to real inboxes.

### 1) Create `.env` at project root

Use this as a starting point:

```env
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,0.0.0.0
FRONTEND_URL=http://localhost:5173

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
- For Gmail, use an app password (not your normal account password).
- If SMTP values are incomplete, backend auto-falls back to console backend.

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

### 4) Features now available

- Registration sends verification email link.
- Login page has "Forgot password?".
- Password reset request sends reset link email.
- Reset page updates password with backend validation.
