# Sprint 2 Demo Script (Catalog + Compliance + Reviews)

## 1. Setup
1. Start backend, run migrations, and seed `seed_demo_data` + `seed_catalog_demo`.
2. Open app and login as `customer@example.com`.
3. Navigate to Marketplace.

## 2. TC-004 Category Browsing
1. Show full product list from real API.
2. Select category `Vegetables`.
3. Show list changes and product cards (name, producer, price, availability).
4. Select additional category (e.g., `Dairy`) to show combined category filtering.

## 3. TC-005 Search
1. Search for `tomato` (product name).
2. Search for `grass-fed` (description text).
3. Search for `Green Valley` (producer name).
4. Search for `zzzz` and show empty state `No results found`.

## 4. TC-014 Organic
1. Toggle `Organic only`.
2. Combine organic with category + search and confirm backend-driven list update.
3. Open one organic product detail and show organic status/badge.

## 5. TC-015 Allergen Warnings
1. Open a product with allergens (e.g., milk/bread).
2. Highlight prominent allergen warning block above add-to-cart controls.
3. Show allergen acknowledgement checkbox and demonstrate add-to-cart is blocked until checked.
4. Open a product with no listed allergens and show `No common allergens`.

## 6. TC-016 Seasonal Availability
1. Login as `producer@example.com` and open Producer Inventory.
2. Show the month-based `Season starts` / `Season ends` controls for a seasonal product.
3. Show the `Season starting soon` reminder card for a future seasonal product.
4. Open marketplace and point out an in-season product badge and visible seasonal month range.
5. Open or search for an out-of-season product and show that it is unavailable to order.
6. Attempt to add that out-of-season product to cart as a customer and show the order block message.

## 7. TC-024 Reviews Scaffold
1. On product detail, open Reviews section.
2. Show average rating and populated read-only reviews list.
3. Open product with no reviews to show empty state.
4. Show disabled `Write review (coming soon)` placeholder.
5. Call out dependency: verified-purchase submission requires catalog-to-delivered-order eligibility and per-user uniqueness constraints (see blocker note).

## 8. TC-017 Community Bulk Order
1. Login as a community user and open Community Dashboard.
2. Start a bulk order in marketplace, add large quantities from multiple producers.
3. In checkout, set per-producer delivery dates and special delivery instructions.
4. Confirm order response shows producer contacts and supplier breakdown.

## 9. TC-018 Restaurant Recurring Orders
1. Login as a restaurant user and create an initial multi-producer checkout.
2. Enable â€œMake this a recurring orderâ€ and set frequency/order day/delivery day.
3. Open Restaurant Recurring Orders page; modify next instance quantities.
4. Run recurring generation from UI or `python manage.py generate_recurring_orders`.

## 10. TC-025 Admin Commission Reporting
1. Login as admin and open Network Commission / Financial Reports.
2. Filter by date range (2+ weeks), producer, and status.
3. Validate totals and per-order producer payout breakdown.
4. Click an order for drilldown and export the CSV report.
