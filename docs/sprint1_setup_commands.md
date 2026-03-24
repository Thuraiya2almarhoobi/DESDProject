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

## Docker (web + PostgreSQL containers)
```bash
docker compose up --build
```

Notes:
- `web` container runs migrations, `seed_demo_data`, and `seed_catalog_demo` on startup.
- `db` container runs PostgreSQL 16 and persists data in a Docker volume.
- After startup, open: `http://127.0.0.1:8000/`

## Tests
```bash
python3 manage.py test apps.catalog
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
