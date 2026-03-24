# Sprint 2 Setup and Commands

## Backend (Django + DRF)
```bash
# Requires PostgreSQL running (see Docker section below)
python3 manage.py migrate
python3 manage.py seed_demo_data
python3 manage.py seed_catalog_demo
python3 manage.py runserver
```

## Frontend (Vite dev mode)
```bash
cd DESD
npm install
npm run dev
```

Notes:
- Frontend default API base URL is `/api`.
- Vite proxy forwards `/api` to `http://127.0.0.1:8000`.
- Mock catalog fallback is opt-in only (`VITE_USE_MOCK_PRODUCTS=true`).

## Docker (web + PostgreSQL + Stripe + Stuart microservice containers)
Set the payment and delivery sandbox credentials before starting Docker:
```bash
export STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
export STRIPE_SECRET_KEY=sk_test_your_key_here
export STRIPE_WEBHOOK_SECRET=whsec_your_key_here
export STUART_CLIENT_ID=your_stuart_client_id
export STUART_CLIENT_SECRET=your_stuart_client_secret
export STUART_ACCOUNT_ID=your_stuart_account_id
export STUART_BASE_URL=https://api.sandbox.stuart.com
export STUART_WEBHOOK_SECRET=your_local_webhook_secret
export STUART_SERVICE_SHARED_SECRET=your_local_internal_service_secret
export DELIVERY_SIMULATION_ENABLED=true
export DELIVERY_SIMULATION_TOTAL_SECONDS=120
export DELIVERY_SIMULATION_POLL_SECONDS=15
```

```bash
docker compose up --build
```

Notes:
- `web` container runs migrations, `seed_demo_data`, and `seed_catalog_demo` on startup.
- `db` container runs PostgreSQL 16 and persists data in a Docker volume.
- `payments` container is the Stripe microservice used for Checkout Session creation and webhook verification.
- `stuart` container is the Stuart Sandbox microservice used for OAuth, delivery creation, refresh, and cancellation.
- After startup, open: `http://127.0.0.1:8000/`
- Customer checkout redirects to Stripe in test mode, then returns to `http://127.0.0.1:8000/checkout/success` or `http://127.0.0.1:8000/checkout/cancel`.
- Producer dispatch to Stuart happens when a producer sub-order is moved from `confirmed` to `ready`.
- Stuart sandbox deliveries now auto-start an in-app rider simulation for demo/testing when `DELIVERY_SIMULATION_ENABLED=true`.
- The same live map appears in producer orders and customer current-order tracking.
- Make sure the Google Cloud project for `VITE_GOOGLE_MAPS_API_KEY` has the **Maps JavaScript API** enabled, not just the embed endpoints.

## Stuart Sandbox Webhook Setup
Stuart delivery updates are received by Django, not by the `stuart` container directly.

1. Start the stack:
```bash
docker compose up --build
```
2. Expose the local Django app with a tunnel:
```bash
ngrok http 8000
```
3. In the Stuart Sandbox dashboard, configure the webhook target URL as:
```text
https://YOUR-NGROK-SUBDOMAIN.ngrok.app/api/delivery/stuart/webhook/
```
4. Configure the webhook secret to match `STUART_WEBHOOK_SECRET`.
5. Subscribe only to lifecycle events needed for:
   - job created
   - courier assigned
   - in transit / pickup
   - delivered
   - cancelled / failed
   - ETA or tracking updates

Notes:
- Stuart’s quick start guide requires a Sandbox account and a test card on the Stuart billing profile before API calls will succeed.
- `STUART_SERVICE_SHARED_SECRET` is only for `web -> stuart` internal container traffic.
- Webhooks are still supported, but they are no longer required to demonstrate the in-app rider movement for sandbox deliveries.
- The customer-facing app keeps using the existing order-tracking page, now enriched with an in-app live map, Stuart status, ETA, courier details, and tracking links.

## Tests
```bash
python3 manage.py test apps.catalog
python3 manage.py test apps.orders.tests_tc_017_018_025
python3 manage.py test apps.delivery.tests apps.orders.tests
python3 -m unittest stuart_service.tests
```

## API Endpoints Implemented
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products?category=<slug|id|comma-separated>`
- `GET /api/products?search=<query>`
- `GET /api/products?organic=true`
- Combined filters via query params (e.g. `category + organic + search`)
- `GET /api/products/:id/reviews`
- `GET /api/categories`

## Sprint 2 Additions (TC-017 / TC-018 / TC-025)
- Community bulk checkout alias: `POST /api/community/bulk-checkout/`
- Community confirmation: `GET /api/community/orders/<id>/confirmation/`
- Restaurant recurring templates:
  - `POST /api/restaurant/recurring-orders/`
  - `GET /api/restaurant/recurring-orders/`
  - `GET /api/restaurant/recurring-orders/<id>/`
  - `PATCH /api/restaurant/recurring-orders/<id>/`
  - `PATCH /api/restaurant/recurring-orders/<id>/next-instance/`
  - `POST /api/restaurant/recurring-orders/run/`
- Admin commission reporting:
  - `GET /api/admin/commission-report/?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - `GET /api/admin/commission-report/<order_id>/`
  - `GET /api/admin/commission-report/export.csv?start=...&end=...`
  - `GET /api/admin/commission-report/summary/monthly?year=YYYY`
  - `GET /api/admin/commission-report/summary/ytd?year=YYYY`

### Recurring Generation Command
```bash
python3 manage.py generate_recurring_orders
# Optional explicit run date:
python3 manage.py generate_recurring_orders --run-date 2026-03-09
```

## API Field Mapping (Backend -> Frontend Product type)
- `id` -> `id` (stringified client-side)
- `name` -> `name`
- `description` -> `description`
- `price` -> `price` (number)
- `unit` -> `unit`
- `producer_id` -> `producerId`
- `producer_name` -> `producerName`
- `producer_location` -> `producerLocation`
- `category` -> `category`
- `availability` -> `availability`
- `is_organic` -> `isOrganic`
- `organic_certification` -> `organicCertification`
- `allergens` -> `allergens`
- `seasonal_dates` -> `seasonalDates`
- `image_url` -> `imageUrl`
- `producer_description` -> `producerDescription`
- `producer_delivery_lead_time` -> `producerDeliveryLeadTime`
- `producer_postcode` -> `producerPostcode`
- `producer_latitude` + `producer_longitude` -> `producerCoordinates`
