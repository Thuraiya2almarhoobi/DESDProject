import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { MapPage } from './pages/MapPage';
import { ContentFeedPage } from './pages/ContentFeedPage';
import { ProducerDashboardPage } from './pages/producer/ProducerDashboardPage';
import { ProducerOrdersPage } from './pages/producer/ProducerOrdersPage';
import { ProducerInventoryPage } from './pages/producer/ProducerInventoryPage';
import { ProducerPaymentsPage } from './pages/producer/ProducerPaymentsPage';
import { AdminCommissionPage } from './pages/admin/AdminCommissionPage';
import { CommunityDashboardPage } from './pages/community/CommunityDashboardPage';
import { RestaurantDashboardPage } from './pages/restaurant/RestaurantDashboardPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },
  // Customer routes
  {
    path: '/marketplace',
    element: (
      <ProtectedRoute allowedRoles={['CUSTOMER']}>
        <MarketplacePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/product/:id',
    element: (
      <ProtectedRoute allowedRoles={['CUSTOMER']}>
        <ProductDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cart',
    element: (
      <ProtectedRoute allowedRoles={['CUSTOMER']}>
        <CartPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/checkout',
    element: (
      <ProtectedRoute allowedRoles={['CUSTOMER']}>
        <CheckoutPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/orders/history',
    element: (
      <ProtectedRoute allowedRoles={['CUSTOMER']}>
        <OrderHistoryPage />
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
      <ProtectedRoute allowedRoles={['CUSTOMER']}>
        <ContentFeedPage />
      </ProtectedRoute>
    ),
  },
  // Producer routes
  {
    path: '/producer/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['PRODUCER']}>
        <ProducerDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/producer/orders',
    element: (
      <ProtectedRoute allowedRoles={['PRODUCER']}>
        <ProducerOrdersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/producer/inventory',
    element: (
      <ProtectedRoute allowedRoles={['PRODUCER']}>
        <ProducerInventoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/producer/payments',
    element: (
      <ProtectedRoute allowedRoles={['PRODUCER']}>
        <ProducerPaymentsPage />
      </ProtectedRoute>
    ),
  },
  // Community routes
  {
    path: '/community/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['COMMUNITY']}>
        <CommunityDashboardPage />
      </ProtectedRoute>
    ),
  },
  // Restaurant routes
  {
    path: '/restaurant/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['RESTAURANT']}>
        <RestaurantDashboardPage />
      </ProtectedRoute>
    ),
  },
  // Admin routes
  {
    path: '/admin/commission',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminCommissionPage />
      </ProtectedRoute>
    ),
  },
  // 404
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
