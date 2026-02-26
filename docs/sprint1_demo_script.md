# Sprint 1 Demo Script (Catalog + Compliance + Reviews)

## 1. Setup
1. Start backend, run migrations, and seed demo catalog data.
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
2. Combine organic with category + search.
3. Open one organic product detail and show organic status/badge.

## 5. TC-015 Allergen Warnings
1. Open a product with allergens (e.g., milk/bread).
2. Highlight prominent allergen warning block above add-to-cart controls.
3. Show allergen acknowledgement checkbox and demonstrate add-to-cart is blocked until checked.
4. Open a product with no listed allergens and show `No common allergens`.

## 6. TC-016 Seasonal Availability
1. On marketplace, point out availability badges on cards.
2. Open product detail and show seasonal date range text where present.
3. Show an unavailable item to demonstrate status handling.

## 7. TC-024 Reviews Scaffold
1. On product detail, open Reviews section.
2. Show populated read-only reviews list.
3. Open product with no reviews to show empty state.
4. Show disabled `Write review (coming soon)` placeholder.
5. Call out dependency: verified-purchase submission requires order/delivery integration in another lane.
