# Sprint 2 Manual Test Checklist (Catalog/Compliance/Reviews)

Status legend:
- `Not Run`
- `Pass`
- `Fail`

## TC-004 Category browsing [Critical]
- Scenario: Customer browses by category with real API data.
- Preconditions: Backend seeded with `python3 manage.py seed_demo_data`.
- Steps:
  1. Login as `customer@example.com`.
  2. Open `/marketplace`.
  3. Select category filters (e.g., `Vegetables`, `Dairy Products`, `Bakery`).
- Expected result:
  - Product list updates using backend data.
  - Product cards show name, price, producer, and availability badge.
  - Loading, empty, and error states render correctly.
- Actual result: `__________`
- Status: `Not Run`

## TC-005 Search products [High]
- Scenario: Customer searches by product, description, and producer name.
- Preconditions: Seeded backend data is available.
- Steps:
  1. Search `tomato`, then `grass-fed`, then producer term like `Green Valley`.
  2. Clear query and search a non-existent term (e.g., `zzzz`).
- Expected result:
  - Results are backend-driven and case-insensitive.
  - Matching products appear for product/description/producer terms.
  - Empty query result state shows `No results found`.
- Actual result: `__________`
- Status: `Not Run`

## TC-014 Organic filter/status [Medium]
- Scenario: Organic status visible and filterable.
- Preconditions: Run `python3 manage.py seed_catalog_demo` (or start Docker stack with auto-seeding).
- Steps:
  1. On marketplace, toggle `Organic only`.
  2. Combine with category and search filters.
  3. Open a product detail page.
- Expected result:
  - Organic products display badge/status on list + detail.
  - Organic filter is reflected in backend query and can be combined.
- Actual result: `__________`
- Status: `Not Run`

## TC-015 Allergen warnings display [Critical]
- Scenario: Product detail shows allergen warnings prominently.
- Preconditions: One product with allergens (e.g., milk/bread) and one without.
- Steps:
  1. Open product detail with allergens.
  2. Open product detail without allergens.
- Expected result:
  - Allergen warning block is prominent and visible before add-to-cart controls.
  - Multiple allergens are listed where present.
  - Fallback message `No common allergens` shows when list is empty.
  - Allergen-containing products require allergen acknowledgement before add-to-cart.
- Actual result: `__________`
- Status: `Not Run`

## TC-016 Seasonal availability [High]
- Scenario: Producer-configured season windows automatically control customer availability and reminders.
- Preconditions: Run `python3 manage.py seed_demo_data` or Docker auto-seed so producer and order products include seasonal windows.
- Steps:
  1. Login as `producer@example.com` and open `/producer/inventory`.
  2. Confirm at least one product shows a seasonal window and one product appears under `Season starting soon`.
  3. Edit a seasonal product and confirm the producer can set `Season starts` and `Season ends` with month dropdowns.
  4. Open marketplace and confirm an in-season product shows `In Season` with its month range.
  5. Open marketplace and confirm an out-of-season product is hidden from the default in-stock view.
  6. Open the out-of-season product detail page directly and confirm it shows unavailable/out-of-season status plus the seasonal education message.
  7. While logged in as a customer, attempt to add an out-of-season product to cart.
- Expected result:
  - Producer can configure seasonal months without technical input.
  - Seasonal reminder appears before a product becomes available.
  - Availability updates automatically from the current date and configured month window.
  - Customers cannot add out-of-season products to cart.
  - Marketplace/detail pages show seasonal window text and educational context.
- Actual result: `__________`
- Status: `Not Run`

## TC-024 Reviews scaffold [Medium]
- Scenario: Product page has read-only reviews scaffold.
- Preconditions: Run `python3 manage.py seed_catalog_demo` (or start Docker stack with auto-seeding).
- Steps:
  1. Open product detail page.
  2. Scroll to Reviews section.
  3. Check product with and without review records.
- Expected result:
  - Average rating appears when review data exists.
  - Read-only review list appears when data exists.
  - Empty state appears when no reviews exist.
  - `Write review` placeholder is present.
  - Dependency note indicates verified-purchase submission flow is pending order/delivery integration and is documented in `docs/tc024_verified_purchase_blocker.md`.
- Actual result: `__________`
- Status: `Not Run`
