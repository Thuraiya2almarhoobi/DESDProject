/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Frontend source file for routes.
 *
 * Frontend context:
 *   Frontend source module for the React/Vite application.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './components/AppShell';
import { AdminLayout } from './components/admin/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { SiteShell } from './components/SiteShell';
import { AnimatedOutlet } from './components/motion/Motion';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage } from './pages/LoginPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { PublicBrowsePage } from './pages/PublicBrowsePage';
import { PublicProductDetailPage } from './pages/PublicProductDetailPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { MapPage } from './pages/MapPage';
import { ContentFeedPage } from './pages/ContentFeedPage';
import { AccountPage } from './pages/AccountPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProducerDashboardPage } from './pages/producer/ProducerDashboardPage';
import { ProducerOrdersPage } from './pages/producer/ProducerOrdersPage';
import { ProducerInventoryPage } from './pages/producer/ProducerInventoryPage';
import { ProducerNotificationsPage } from './pages/producer/ProducerNotificationsPage';
import { ProducerPaymentsPage } from './pages/producer/ProducerPaymentsPage';
import { AdminCommissionPage } from './pages/admin/AdminCommissionPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminModerationPage } from './pages/admin/AdminModerationPage';
import { CommunityDashboardPage } from './pages/community/CommunityDashboardPage';
import { PortalSelectPage } from './pages/portal/PortalSelectPage';
import { RoleRegisterPage } from './pages/portal/RoleRegisterPage';
import { StakeholderPortalPage } from './pages/portal/StakeholderPortalPage';
import { ProducersPage } from './pages/ProducersPage';
import { ProducerProfilePage } from './pages/ProducerProfilePage';
import { ProducerSearchPage } from './pages/ProducerSearchPage';
import { LegalPage } from './pages/LegalPage';
import { RestaurantDashboardPage } from './pages/restaurant/RestaurantDashboardPage';
import { RestaurantRecurringOrdersPage } from './pages/restaurant/RestaurantRecurringOrdersPage';

/**
 * Central frontend route map.
 *
 * Layout structure:
 * - AppShell wraps the whole SPA
 * - SiteShell provides shared public/buyer-facing chrome
 * - AdminLayout provides the separate administrator workspace
 *
 * Security structure:
 * - ProtectedRoute allows a set of authenticated roles
 * - RoleProtectedRoute restricts a route to one required role
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: '/admin/product-preview/:id',
        element: (
          <RoleProtectedRoute requiredRole="ADMIN">
            <ProductDetailPage />
          </RoleProtectedRoute>
        ),
      },
      {
        path: '/admin/producer-preview/:producerId',
        element: (
          <RoleProtectedRoute requiredRole="ADMIN">
            <ProducerProfilePage />
          </RoleProtectedRoute>
        ),
      },
      {
        path: '/admin/content-preview/recipes',
        element: (
          <RoleProtectedRoute requiredRole="ADMIN">
            <ContentFeedPage contentView="recipes" />
          </RoleProtectedRoute>
        ),
      },
      {
        path: '/admin/content-preview/stories',
        element: (
          <RoleProtectedRoute requiredRole="ADMIN">
            <ContentFeedPage contentView="stories" />
          </RoleProtectedRoute>
        ),
      },
      {
        element: <SiteShell />,
        children: [
          // Public marketing and discovery pages.
          {
            path: '/',
            element: <LandingPage />,
          },
          {
            path: '/about',
            element: <AboutPage />,
          },
          {
            path: '/producers',
            element: <ProducersPage />,
          },
          {
            path: '/producer-search',
            element: <ProducerSearchPage />,
          },
          {
            path: '/producers/:producerId',
            element: <ProducerProfilePage />,
          },
          {
            path: '/browse',
            element: <PublicBrowsePage />,
          },
          {
            path: '/browse/product/:id',
            element: <PublicProductDetailPage />,
          },
          {
            path: '/select-portal',
            element: <PortalSelectPage />,
          },
          {
            path: '/landing',
            element: <LandingPage />,
          },
          {
            path: '/terms',
            element: <LegalPage kind="terms" />,
          },
          {
            path: '/privacy',
            element: <LegalPage kind="privacy" />,
          },
          {
            path: '/portal/customer',
            element: <StakeholderPortalPage role="CUSTOMER" />,
          },
          {
            path: '/portal/producer',
            element: <Navigate to="/login" replace />,
          },
          {
            path: '/portal/community',
            element: <Navigate to="/register/community" replace />,
          },
          {
            path: '/portal/restaurant',
            element: <Navigate to="/register/restaurant" replace />,
          },
          {
            path: '/portal/admin',
            element: <Navigate to="/admin/login" replace />,
          },
          // Shared buyer-side routes. Community and restaurant accounts reuse
          // the same purchasing journey as customers.
          {
            path: '/marketplace',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <MarketplacePage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/product/:id',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER', 'ADMIN']}>
                <ProductDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/cart',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <CartPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/checkout',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <CheckoutPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/checkout/success',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <CheckoutPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/checkout/cancel',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <CheckoutPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/orders/history',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <OrderHistoryPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/account',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'PRODUCER', 'COMMUNITY', 'RESTAURANT', 'ADMIN']}>
                <AccountPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/settings',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <SettingsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/map',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <MapPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/content/feed',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <ContentFeedPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/content/recipes',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <ContentFeedPage contentView="recipes" />
              </ProtectedRoute>
            ),
          },
          {
            path: '/content/stories',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <ContentFeedPage contentView="stories" />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        element: <AnimatedOutlet />,
        children: [
          // Standalone authentication routes sit outside SiteShell because they
          // use focused layouts rather than the main marketplace chrome.
          {
            path: '/login',
            element: <LoginPage />,
          },
          {
            path: '/login/customer',
            element: <Navigate to="/login" replace />,
          },
          {
            path: '/login/producer',
            element: <Navigate to="/login" replace />,
          },
          {
            path: '/login/community',
            element: <Navigate to="/login" replace />,
          },
          {
            path: '/login/restaurant',
            element: <Navigate to="/login" replace />,
          },
          {
            path: '/login/admin',
            element: <Navigate to="/admin/login" replace />,
          },
          {
            path: '/admin/login',
            element: <AdminLoginPage />,
          },
          {
            path: '/register',
            element: <Navigate to="/select-portal?mode=register" replace />,
          },
          {
            path: '/register/customer',
            element: <RoleRegisterPage role="CUSTOMER" />,
          },
          {
            path: '/register/producer',
            element: <RoleRegisterPage role="PRODUCER" />,
          },
          {
            path: '/register/community',
            element: <RoleRegisterPage role="COMMUNITY" />,
          },
          {
            path: '/register/restaurant',
            element: <RoleRegisterPage role="RESTAURANT" />,
          },
          {
            path: '/verify-email',
            element: <VerifyEmailPage />,
          },
          {
            path: '/forgot-password',
            element: <ForgotPasswordPage />,
          },
          {
            path: '/reset-password',
            element: <ResetPasswordPage />,
          },
          {
            path: '/access-denied',
            element: <AccessDeniedPage />,
          },
          // Producer workspace routes.
          {
            path: '/producer/dashboard',
            element: (
              <RoleProtectedRoute requiredRole="PRODUCER">
                <ProducerDashboardPage />
              </RoleProtectedRoute>
            ),
          },
          {
            path: '/producer/publish',
            element: (
              <RoleProtectedRoute requiredRole="PRODUCER">
                <ContentFeedPage mode="publish" />
              </RoleProtectedRoute>
            ),
          },
          {
            path: '/producer/content',
            element: (
              <RoleProtectedRoute requiredRole="PRODUCER">
                <Navigate to="/producer/publish" replace />
              </RoleProtectedRoute>
            ),
          },
          {
            path: '/producer/orders',
            element: (
              <RoleProtectedRoute requiredRole="PRODUCER">
                <ProducerOrdersPage />
              </RoleProtectedRoute>
            ),
          },
          {
            path: '/producer/inventory',
            element: (
              <RoleProtectedRoute requiredRole="PRODUCER">
                <ProducerInventoryPage />
              </RoleProtectedRoute>
            ),
          },
          {
            path: '/producer/notifications',
            element: (
              <RoleProtectedRoute requiredRole="PRODUCER">
                <ProducerNotificationsPage />
              </RoleProtectedRoute>
            ),
          },
          {
            path: '/producer/payments',
            element: (
              <RoleProtectedRoute requiredRole="PRODUCER">
                <ProducerPaymentsPage />
              </RoleProtectedRoute>
            ),
          },
          // Community workspace routes.
          {
            path: '/community/dashboard',
            element: (
              <RoleProtectedRoute requiredRole="COMMUNITY">
                <CommunityDashboardPage />
              </RoleProtectedRoute>
            ),
          },
          // Restaurant workspace routes.
          {
            path: '/restaurant/dashboard',
            element: (
              <RoleProtectedRoute requiredRole="RESTAURANT">
                <RestaurantDashboardPage />
              </RoleProtectedRoute>
            ),
          },
          {
            path: '/restaurant/recurring-orders',
            element: (
              <RoleProtectedRoute requiredRole="RESTAURANT">
                <RestaurantRecurringOrdersPage />
              </RoleProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/admin',
        element: <Navigate to="/admin/login" replace />,
      },
      // Custom admin SPA. This is intentionally separate from Django's stock
      // table-based admin, which lives under /django-admin/.
      {
        element: (
          <RoleProtectedRoute requiredRole="ADMIN">
            <AdminLayout />
          </RoleProtectedRoute>
        ),
        children: [
          {
            path: '/admin/dashboard',
            element: <AdminDashboardPage />,
          },
          {
            path: '/admin/financial-reports',
            element: <AdminCommissionPage />,
          },
          {
            path: '/admin/moderation',
            element: <AdminModerationPage />,
          },
          {
            path: '/admin/commission',
            element: <Navigate to="/admin/financial-reports" replace />,
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
