# DESDProject API Inventory

Total endpoints: 82

## Accounts

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/accounts/addresses/` | `GET, POST` | `IsAuthenticated` | `AddressListCreateView` |
| `/api/accounts/addresses/<int:pk>/` | `GET, PUT, PATCH, DELETE` | `IsAuthenticated` | `AddressDetailView` |
| `/api/accounts/admin/only/` | `GET` | `IsAuthenticated, IsAdmin` | `AdminOnlyView` |
| `/api/accounts/auth/login/` | `POST` | `AllowAny` | `LoginView` |
| `/api/accounts/auth/password-reset/confirm/` | `POST` | `AllowAny` | `PasswordResetConfirmView` |
| `/api/accounts/auth/password-reset/request/` | `POST` | `AllowAny` | `PasswordResetRequestView` |
| `/api/accounts/auth/refresh/` | `POST` | `AllowAny` | `TokenRefreshView` |
| `/api/accounts/auth/register/community/` | `POST` | `AllowAny` | `CommunityRegistrationView` |
| `/api/accounts/auth/register/customer/` | `POST` | `AllowAny` | `CustomerRegistrationView` |
| `/api/accounts/auth/register/producer/` | `POST` | `AllowAny` | `ProducerRegistrationView` |
| `/api/accounts/auth/register/restaurant/` | `POST` | `AllowAny` | `RestaurantRegistrationView` |
| `/api/accounts/auth/verify-email/` | `POST` | `AllowAny` | `VerifyEmailView` |
| `/api/accounts/community/only/` | `GET` | `IsAuthenticated, IsCommunity` | `CommunityOnlyView` |
| `/api/accounts/customer/only/` | `GET` | `IsAuthenticated, IsCustomer` | `CustomerOnlyView` |
| `/api/accounts/me/` | `GET, PATCH` | `IsAuthenticated` | `MeView` |
| `/api/accounts/producer/only/` | `GET` | `IsAuthenticated, IsProducer` | `ProducerOnlyView` |
| `/api/accounts/restaurant/only/` | `GET` | `IsAuthenticated, IsRestaurant` | `RestaurantOnlyView` |
| `/api/accounts/uploads/images/` | `POST` | `IsAuthenticated` | `ImageUploadView` |

## Admin

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/admin/commission-report/` | `GET` | `IsAuthenticated, IsAdmin` | `AdminCommissionReportAPIView` |
| `/api/admin/commission-report/<int:order_id>/` | `GET` | `IsAuthenticated, IsAdmin` | `AdminCommissionReportDetailAPIView` |
| `/api/admin/commission-report/export.csv` | `GET` | `IsAuthenticated, IsAdmin` | `AdminCommissionReportExportCSVAPIView` |
| `/api/admin/commission-report/summary/monthly` | `GET` | `IsAuthenticated, IsAdmin` | `AdminCommissionMonthlySummaryAPIView` |
| `/api/admin/commission-report/summary/ytd` | `GET` | `IsAuthenticated, IsAdmin` | `AdminCommissionYTDSummaryAPIView` |

## Catalog

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/catalog` | `GET` | `AllowAny` | `APIRootView` |
| `/api/catalog/categories` | `GET` | `AllowAny` | `CategoryListAPIView` |
| `/api/catalog/products` | `GET` | `AllowAny` | `ProductViewSet` |
| `/api/catalog/products/{pk}` | `GET` | `AllowAny` | `ProductViewSet` |
| `/api/catalog/products/{pk}/reviews` | `GET, POST` | `AllowAny` | `ProductViewSet` |

## Community

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/community/bulk-checkout/` | `POST` | `IsAuthenticated, IsCommunity` | `CommunityBulkCheckoutAPIView` |
| `/api/community/orders/<int:order_id>/confirmation/` | `GET` | `IsAuthenticated, IsCommunity` | `CommunityOrderConfirmationAPIView` |

## Content

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/content/feed/` | `GET` | `IsAuthenticated` | `ContentFeedAPIView` |
| `/api/content/producer/products/` | `GET` | `IsAuthenticated` | `ProducerOwnedProductsAPIView` |
| `/api/content/products/<int:product_id>/recipes/` | `GET` | `IsAuthenticated` | `ProductRecipesAPIView` |
| `/api/content/recipes/` | `GET, POST` | `IsAuthenticated` | `RecipeListCreateAPIView` |
| `/api/content/recipes/<int:recipe_id>/` | `GET, PATCH, DELETE` | `IsAuthenticated` | `RecipeDetailAPIView` |
| `/api/content/recipes/<int:recipe_id>/save/` | `POST` | `IsAuthenticated` | `ToggleSavedRecipeAPIView` |
| `/api/content/stories/` | `GET, POST` | `IsAuthenticated` | `FarmStoryListCreateAPIView` |
| `/api/content/stories/<int:story_id>/` | `GET, PATCH, DELETE` | `IsAuthenticated` | `FarmStoryDetailAPIView` |

## Geo

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/geo/food-miles/cart/` | `GET` | `IsAuthenticated` | `CartFoodMilesAPIView` |
| `/api/geo/producers-near-me/` | `GET` | `IsAuthenticated` | `ProducersNearMeAPIView` |

## Legacy Catalog

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/categories` | `GET` | `AllowAny` | `CategoryListAPIView` |
| `/api/products` | `GET` | `AllowAny` | `ProductViewSet` |
| `/api/products/{pk}` | `GET` | `AllowAny` | `ProductViewSet` |
| `/api/products/{pk}/reviews` | `GET, POST` | `AllowAny` | `ProductViewSet` |

## Orders

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/orders/cart/` | `GET` | `IsAuthenticated` | `CartAPIView` |
| `/api/orders/cart/items/` | `POST` | `IsAuthenticated` | `CartItemAddAPIView` |
| `/api/orders/cart/items/<int:item_id>/` | `PATCH, DELETE` | `IsAuthenticated` | `CartItemDetailAPIView` |
| `/api/orders/checkout/` | `POST` | `IsAuthenticated` | `CheckoutAPIView` |
| `/api/orders/checkout/preview/` | `GET` | `IsAuthenticated` | `CheckoutPreviewAPIView` |
| `/api/orders/history/` | `GET` | `IsAuthenticated` | `OrderHistoryAPIView` |
| `/api/orders/history/<int:order_id>/` | `GET` | `IsAuthenticated` | `OrderDetailAPIView` |
| `/api/orders/history/<int:order_id>/receipt/` | `GET` | `IsAuthenticated` | `OrderReceiptAPIView` |
| `/api/orders/history/<int:order_id>/reorder/` | `POST` | `IsAuthenticated` | `OrderReorderAPIView` |
| `/api/orders/producer/sub-orders/` | `GET` | `IsAuthenticated` | `ProducerSubOrderListAPIView` |
| `/api/orders/producer/sub-orders/<int:sub_order_id>/status/` | `PATCH` | `IsAuthenticated` | `ProducerSubOrderStatusUpdateAPIView` |
| `/api/orders/producers/` | `GET, POST` | `IsAuthenticated` | `ProducerListCreateAPIView` |
| `/api/orders/products/` | `GET, POST` | `IsAuthenticated` | `ProductListCreateAPIView` |
| `/api/orders/products/<int:pk>/` | `GET` | `IsAuthenticated` | `ProductDetailAPIView` |
| `/api/orders/products/<int:product_id>/reviews/` | `GET, POST` | `IsAuthenticated` | `ProductReviewsAPIView` |
| `/api/orders/profile/` | `GET, PUT` | `IsAuthenticated` | `CustomerProfileAPIView` |

## Payments

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/payments/settlements/` | `GET` | `IsAuthenticated` | `WeeklySettlementListAPIView` |
| `/api/payments/settlements/<int:pk>/` | `GET` | `IsAuthenticated` | `WeeklySettlementDetailAPIView` |
| `/api/payments/settlements/<int:pk>/export/` | `GET` | `IsAuthenticated` | `WeeklySettlementExportCSVAPIView` |
| `/api/payments/settlements/run-weekly/` | `POST` | `IsAuthenticated` | `TriggerWeeklySettlementsAPIView` |
| `/api/payments/stripe/checkout-session/` | `POST` | `IsAuthenticated` | `StripeCheckoutSessionCreateAPIView` |
| `/api/payments/stripe/checkout-session/cancel/` | `POST` | `IsAuthenticated` | `StripeCheckoutCancelAPIView` |
| `/api/payments/stripe/checkout-session/confirm/` | `POST` | `IsAuthenticated` | `StripeCheckoutSessionConfirmAPIView` |
| `/api/payments/stripe/webhook/` | `POST` | `AllowAny` | `StripeWebhookAPIView` |

## Producer

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/producer/inventory/low-stock/` | `GET` | `AllowAny` | `ProducerLowStockAlertsAPIView` |
| `/api/producer/orders/` | `GET` | `IsAuthenticated` | `ProducerOrdersInboxAPIView` |
| `/api/producer/orders/<int:pk>/` | `GET` | `IsAuthenticated` | `ProducerOrderDetailAPIView` |
| `/api/producer/orders/<int:pk>/status/` | `PATCH` | `IsAuthenticated` | `ProducerOrderStatusUpdateAPIView` |
| `/api/producer/products/` | `GET, POST` | `AllowAny` | `ProducerProductListCreateAPIView` |
| `/api/producer/products/<int:pk>/` | `GET, PUT, PATCH, DELETE` | `AllowAny` | `ProducerProductDetailAPIView` |
| `/api/producer/products/<int:pk>/surplus/` | `PATCH` | `AllowAny` | `ProducerSurplusDealAPIView` |
| `/api/producer/public/products/` | `GET` | `AllowAny` | `PublicMarketplaceProductsAPIView` |
| `/api/producer/public/products/<int:pk>/` | `GET` | `AllowAny` | `PublicMarketplaceProductDetailAPIView` |

## Restaurant

| Path | Methods | Permissions | View |
| --- | --- | --- | --- |
| `/api/restaurant/recurring-orders/` | `GET, POST` | `IsAuthenticated, IsRestaurant` | `RestaurantRecurringOrderListCreateAPIView` |
| `/api/restaurant/recurring-orders/<int:pk>/` | `GET, PATCH` | `IsAuthenticated, IsRestaurant` | `RestaurantRecurringOrderDetailAPIView` |
| `/api/restaurant/recurring-orders/<int:pk>/generated/` | `GET` | `IsAuthenticated, IsRestaurant` | `RestaurantRecurringOrderGeneratedListAPIView` |
| `/api/restaurant/recurring-orders/<int:pk>/next-instance/` | `PATCH` | `IsAuthenticated, IsRestaurant` | `RestaurantRecurringOrderNextInstanceAPIView` |
| `/api/restaurant/recurring-orders/run/` | `POST` | `IsAuthenticated` | `RestaurantRecurringOrderRunAPIView` |
