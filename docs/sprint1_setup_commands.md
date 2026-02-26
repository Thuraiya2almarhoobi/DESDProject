# Sprint 1 Setup and Commands

## Backend (Django + DRF)
```bash
python3 manage.py migrate
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
- Vite proxy forwards `/api` to `http://localhost:8000`.
- Mock catalog fallback is opt-in only (`VITE_USE_MOCK_PRODUCTS=true`).

## Docker (integrated build + serve from Django)
```bash
docker compose up --build
```

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
