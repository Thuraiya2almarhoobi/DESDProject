# Sprint 2 Frontend Manual Checklist

## TC-014 Organic Filter / Organic Status

### Preconditions
- Backend is running and catalog demo data has been seeded.
- Frontend is running against the real backend API (`VITE_USE_MOCK_PRODUCTS` unset or `false`).

### Steps
1. Sign in as a customer and open `/marketplace`.
2. Confirm at least one product card displays the organic badge.
3. Open the Filters panel and enable `Organic only`.
4. Verify the product list refreshes and only organic products remain.
5. Add a category filter and a search term while `Organic only` is still enabled.
6. Confirm combined filtering still returns only matching organic products.
7. Use a search/category combination that has no organic matches.
8. Confirm the empty state clearly says no organic products match and offers a way to show all products.
9. Open an organic product detail page.
10. Confirm organic status/certification is visible on the detail page.

### Expected Result
- Organic badges show on cards and detail pages.
- `Organic only` filters real backend results.
- Organic filter combines cleanly with search/category filters.
- Empty state messaging is clear when no organic products match.

### Actual Result
- [ ] Pass
- Notes:

## TC-024 Reviews

### Preconditions
- Backend is running and catalog demo data has been seeded with product reviews.
- Frontend is running against the real backend API.
- A customer demo account is available for posting a review.

### Steps
1. Open a product detail page that has seeded reviews.
2. Scroll to the `Customer Reviews` section.
3. Confirm average rating is shown from fetched review data.
4. Confirm each review shows reviewer name, star rating, review text, and date.
5. Confirm verified purchase badge appears only when the API marks it true.
6. While logged out, confirm the page prompts you to log in before writing a review.
7. Log in as a customer and open a product without your own review yet.
8. Select a star rating, enter a comment, and submit the review.
9. Confirm the new review appears immediately in the reviews list.
10. Confirm trying to submit a second review for the same product is blocked.
11. Open a product detail page with no reviews.
12. Confirm the empty state says no reviews yet and does not crash.

### Expected Result
- Reviews load from the backend review endpoint.
- Average rating is computed and displayed when reviews exist.
- Logged-in customers can submit one review per product with a star rating and optional comment.
- Duplicate review attempts are blocked cleanly.
- Empty state behaves cleanly.
- The UI reflects backend limitations honestly: verified purchase badges are still limited to backend-linked data.

### Actual Result
- [ ] Pass
- Notes:
