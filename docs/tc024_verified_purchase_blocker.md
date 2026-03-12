# TC-024 Blocker Note: Verified-Purchase Review Submission

## Current status
- Implemented for Sprint scope: read-only reviews on product detail (`GET /api/products/:id/reviews`) with average rating, loading/error/empty states, and disabled "Write review" placeholder.
- Deferred: full verified-purchase submission flow.

## Why full submit is blocked
- `ProductReview` currently links to `apps.catalog.Product`, while delivered-order history is modeled in `apps.orders` against a different product model (`apps.orders.Product`).
- There is no canonical product-link key that safely proves "this authenticated user received this catalog product".
- `ProductReview` does not currently store an authenticated user foreign key, so one-review-per-user-per-product cannot be enforced correctly.

## Dependency required to unblock
1. A canonical product identity bridge between catalog products and order items used for delivery status checks.
2. Review model support for authenticated reviewer identity (`user` FK) plus uniqueness constraint per `(user, product)`.
3. Eligibility service/check that allows submission only when a delivered order exists for that user-product pair.
