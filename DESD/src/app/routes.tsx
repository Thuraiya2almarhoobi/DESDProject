import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { LoginPage } from './pages/LoginPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ProducerDashboardPage } from './pages/producer/ProducerDashboardPage';
import { ProducerOrdersPage } from './pages/producer/ProducerOrdersPage';
import { ProducerInventoryPage } from './pages/producer/ProducerInventoryPage';
import { ProducerPaymentsPage } from './pages/producer/ProducerPaymentsPage';
import { AdminCommissionPage } from './pages/admin/AdminCommissionPage';

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
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },
  // Customer routes
  {
    path: '/marketplace',
    element: (
      <ProtectedRoute allowedRoles={['customer']}>
        <MarketplacePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/product/:id',
    element: (
      <ProtectedRoute allowedRoles={['customer']}>
        <ProductDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cart',
    element: (
      <ProtectedRoute allowedRoles={['customer']}>
        <CartPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/checkout',
    element: (
      <ProtectedRoute allowedRoles={['customer']}>
        <CheckoutPage />
      </ProtectedRoute>
    ),
  },
  // Producer routes
  {
    path: '/producer/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['producer']}>
        <ProducerDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/producer/orders',
    element: (
      <ProtectedRoute allowedRoles={['producer']}>
        <ProducerOrdersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/producer/inventory',
    element: (
      <ProtectedRoute allowedRoles={['producer']}>
        <ProducerInventoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/producer/payments',
    element: (
      <ProtectedRoute allowedRoles={['producer']}>
        <ProducerPaymentsPage />
      </ProtectedRoute>
    ),
  },
  // Admin routes
  {
    path: '/admin/commission',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
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
