# DESD Local Food Marketplace

## Project Overview

DESD is a local food marketplace built for customers, community buyers, restaurants, producers, and platform administrators. The app supports product browsing, cart and checkout, saved delivery addresses, producer inventory, producer orders, recurring restaurant orders, surplus deals, notifications, settlements, and admin commission reporting.

The default Docker setup serves the Django API and the built React frontend from:

```text
http://localhost:8000
```

## Technologies Used

- Django and Django REST Framework for the backend API
- PostgreSQL for the database
- Django CORS Headers and Simple JWT for browser/API access and token authentication
- React, TypeScript, and Vite for the frontend
- Tailwind CSS, Radix UI-style local components, Lucide icons, and MUI packages for styling and interface controls
- Recharts for admin and reporting charts
- Sonner for frontend toast notifications
- Docker Compose for local development
- Stripe test-mode style payment flow for demo checkout
- Stuart delivery service wrapper and delivery simulation settings for local fulfilment demos
- Google Maps/address autocomplete configuration where API keys are supplied
- Google Vertex AI and Gemini-compatible content generation settings for optional recipe/story assistance
- ReportLab and OpenPyXL for report/export support
- Django console email backend for local notification/email demos

## Environment Setup

Create a `.env` file in the project root. These values are enough for local demo mode:

```env
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,0.0.0.0
FRONTEND_URL=http://localhost:8000

POSTGRES_DB=bristol_marketplace
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=sk_test_51_placeholder_replace_me
STRIPE_WEBHOOK_SECRET=whsec_placeholder_replace_me
PAYMENT_SERVICE_SHARED_SECRET=local-payment-service-secret

STUART_SERVICE_SHARED_SECRET=local-stuart-service-secret
DELIVERY_SIMULATION_ENABLED=true
DELIVERY_SIMULATION_TOTAL_SECONDS=120
DELIVERY_SIMULATION_POLL_SECONDS=15

GOOGLE_API_KEY=
VITE_GOOGLE_MAPS_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/application_default_credentials.json
GOOGLE_APPLICATION_CREDENTIALS_HOST=./credentials/application_default_credentials.json

EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=noreply@localfood.test
```

Optional AI/content variables can stay empty for local demo mode:

```env
VERTEX_AI_PROJECT_ID=
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.5-flash
VERTEX_AI_TIMEOUT_SECONDS=30
GEMINI_API_KEY=
VERTEX_AI_API_KEY=
```

## Install And Run With Docker

Start or rebuild the app:

```bash
docker compose up -d --build web
```

Open the app:

```text
http://localhost:8000
```

View recent backend logs:

```bash
docker compose logs web --tail=120
```

Stop services:

```bash
docker compose down
```

Reset all persisted database and media volume data:

```bash
docker compose down -v
docker compose up -d --build web
```

## Run Migrations

The Docker `web` service runs migrations during startup. To run them manually:

```bash
docker compose exec web python manage.py migrate
```

Check whether migrations are missing:

```bash
docker compose exec web python manage.py makemigrations --check --dry-run
```

Run Django system checks:

```bash
docker compose exec web python manage.py check
```

## Seed Demo Data And Test Users

The Docker startup process seeds deterministic demo data. To seed again:

```bash
docker compose exec web python manage.py seed_demo_data
```

To reset and reseed:

```bash
docker compose exec web python manage.py seed_demo_data --reset
```

Main demo accounts:

```text
admin@example.com
producer@example.com
restaurant@example.com
community@example.com
customer@example.com
```

Default password for seeded demo accounts:

```text
DemoPass123!
```

Create an extra Django superuser if needed:

```bash
docker compose exec web python manage.py createsuperuser
```

## Access Customer Producer Restaurant Community And Admin Pages

Use the seeded accounts above, then open the relevant pages:

```text
/marketplace
/cart
/checkout
/orders/history
/producer/dashboard
/producer/orders
/producer/inventory
/producer/payments
/restaurant/dashboard
/restaurant/recurring-orders
/community/dashboard
/admin/overview
/admin/commission
```

Role routing after login should take users to the correct area:

```text
customer@example.com -> /marketplace
producer@example.com -> /producer/dashboard
restaurant@example.com -> /restaurant/dashboard
community@example.com -> /community/dashboard
admin@example.com -> /admin/overview
```

## Admin And API Access

Django admin is available if the backend URL is running and an admin user exists:

```text
http://localhost:8000/admin/
```

Most application API routes are under:

```text
http://localhost:8000/api/
```

Use the frontend login flow for normal demo access. For direct API checks, authenticate with a seeded account or a created superuser depending on the endpoint permissions.

## Test Mode Payment Instructions

Local checkout uses mocked or Stripe test-mode style payment behavior. No real money is charged.

Use the normal checkout flow from the cart. Restaurant and community buyers still use the same demo payment flow, while the UI can show that invoice terms may apply in a real deployment.

Useful Stripe-style test card for demos:

```text
4242 4242 4242 4242
```

Use any future expiry date, any three-digit CVC, and any postcode if a payment form asks for them.

## Automated Tests

Run backend tests inside Docker:

```bash
docker compose exec web python manage.py test apps.orders apps.producer_portal apps.payments apps.content
```

Run a broader Django test pass:

```bash
docker compose exec web python manage.py test
```

Run frontend build verification:

```bash
cd DESD
npm install
npm run build
```

Useful quick regression commands:

```bash
docker compose exec web python manage.py check
docker compose exec web python manage.py makemigrations --check --dry-run
```

## Local Notes

- Uploaded media is stored in the Docker `media_data` volume
- PostgreSQL data is stored in the Docker `postgres_data` volume
- Delivery simulation can run through the local Stuart wrapper settings
- The Docker image builds the React frontend and serves `DESD/dist` through Django
