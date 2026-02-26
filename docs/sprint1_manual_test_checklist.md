# Sprint 1 Manual Test Checklist (Catalog/Compliance/Reviews)

Status legend:
- `Not Run`
- `Pass`
- `Fail`

## TC-004 Category browsing [Critical]
- Scenario: Customer browses by category with real API data.
- Preconditions: Backend seeded with `python3 manage.py seed_catalog_demo`.
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
- Preconditions: Seeded data has organic + non-organic products.
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
- Scenario: Seasonal availability appears on cards and detail.
- Preconditions: Seeded data includes in-season, unavailable, and year-round products.
- Steps:
  1. Observe availability badges in marketplace cards.
  2. Open product detail pages with/without seasonal date ranges.
- Expected result:
  - Badge displays status (`In Season`, `Year-round`, `Unavailable`).
  - Seasonal date text is shown where available.
- Actual result: `__________`
- Status: `Not Run`

## TC-024 Reviews scaffold [Medium]
- Scenario: Product page has read-only reviews scaffold.
- Preconditions: Seeded data includes some reviews.
- Steps:
  1. Open product detail page.
  2. Scroll to Reviews section.
  3. Check product with and without review records.
- Expected result:
  - Read-only review list appears when data exists.
  - Empty state appears when no reviews exist.
  - `Write review` placeholder is present.
  - Dependency note indicates verified-purchase submission flow is pending order/delivery integration.
- Actual result: `__________`
- Status: `Not Run`
