import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { SiteShell } from './components/SiteShell';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
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
import { ProducerPaymentsPage } from './pages/producer/ProducerPaymentsPage';
import { AdminCommissionPage } from './pages/admin/AdminCommissionPage';
import { CommunityDashboardPage } from './pages/community/CommunityDashboardPage';
import { RoleLoginPage } from './pages/portal/RoleLoginPage';
import { PortalSelectPage } from './pages/portal/PortalSelectPage';
import { RoleRegisterPage } from './pages/portal/RoleRegisterPage';
import { StakeholderPortalPage } from './pages/portal/StakeholderPortalPage';
import { RestaurantDashboardPage } from './pages/restaurant/RestaurantDashboardPage';
import { RestaurantRecurringOrdersPage } from './pages/restaurant/RestaurantRecurringOrdersPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        element: <SiteShell />,
        children: [
          {
            path: '/',
            element: <LandingPage />,
          },
          {
            path: '/select-portal',
            element: <PortalSelectPage />,
          },
          {
            path: '/portal/customer',
            element: <StakeholderPortalPage role="CUSTOMER" />,
          },
          {
            path: '/portal/producer',
            element: <StakeholderPortalPage role="PRODUCER" />,
          },
          {
            path: '/portal/community',
            element: <StakeholderPortalPage role="COMMUNITY" />,
          },
          {
            path: '/portal/restaurant',
            element: <StakeholderPortalPage role="RESTAURANT" />,
          },
          {
            path: '/portal/admin',
            element: <StakeholderPortalPage role="ADMIN" />,
          },
          // Customer routes
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
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT', 'PRODUCER']}>
                <ProductDetailPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/cart',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT']}>
                <CartPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/checkout',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT']}>
                <CheckoutPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/checkout/success',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT']}>
                <CheckoutPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/checkout/cancel',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT']}>
                <CheckoutPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/orders/history',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'COMMUNITY', 'RESTAURANT']}>
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
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <SettingsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/map',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <MapPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/content/feed',
            element: (
              <ProtectedRoute allowedRoles={['CUSTOMER', 'PRODUCER']}>
                <ContentFeedPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/login/customer',
        element: <RoleLoginPage role="CUSTOMER" />,
      },
      {
        path: '/login/producer',
        element: <RoleLoginPage role="PRODUCER" />,
      },
      {
        path: '/login/community',
        element: <RoleLoginPage role="COMMUNITY" />,
      },
      {
        path: '/login/restaurant',
        element: <RoleLoginPage role="RESTAURANT" />,
      },
      {
        path: '/login/admin',
        element: <RoleLoginPage role="ADMIN" />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
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
      // Producer routes
      {
        path: '/producer/dashboard',
        element: (
          <RoleProtectedRoute requiredRole="PRODUCER">
            <ProducerDashboardPage />
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
        path: '/producer/payments',
        element: (
          <RoleProtectedRoute requiredRole="PRODUCER">
            <ProducerPaymentsPage />
          </RoleProtectedRoute>
        ),
      },
      // Community routes
      {
        path: '/community/dashboard',
        element: (
          <RoleProtectedRoute requiredRole="COMMUNITY">
            <CommunityDashboardPage />
          </RoleProtectedRoute>
        ),
      },
      // Restaurant routes
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
      // Admin routes
      {
        path: '/admin/commission',
        element: (
          <RoleProtectedRoute requiredRole="ADMIN">
            <AdminCommissionPage />
          </RoleProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

