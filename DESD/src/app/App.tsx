/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Defines the top-level route tree and composes providers, guards, and page components.
 *
 * Frontend context:
 *   Frontend source module for the React/Vite application.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { RouterProvider } from 'react-router';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { Toaster } from './components/ui/sonner';
import { router } from './routes';

/**
 * Local Food Marketplace Platform
 *
 * DEMO FLOW:
 *
 * 1. CUSTOMER JOURNEY (TC-001/002/003/004/005/006/007/008)
 *    - Login: customer@example.com (any password)
 *    - Browse marketplace with category filters
 *    - Search products by name, producer, category
 *    - Filter by organic, in-season, availability
 *    - Click product → view details with harvest date, producer info, allergens
 *    - Add items from multiple producers to cart
 *    - Cart groups items by producer with subtotals
 *    - Checkout: enter address → select delivery dates per producer → payment (sandbox)
 *    - 5% commission shown in checkout summary
 *
 * 2. PRODUCER JOURNEY (TC-009/010/011)
 *    - Login: producer@example.com (any password)
 *    - Dashboard with quick stats
 *    - Orders: view incoming orders sorted by delivery date, update status
 *    - Inventory: manage stock levels, toggle availability
 *    - Payments: view weekly settlements with commission breakdown, export CSV
 *
 * 3. ADMIN JOURNEY (TC-012)
 *    - Login: admin@example.com (any password)
 *    - Commission monitoring dashboard
 *    - View breakdown by producer with date range filter
 *    - Export commission reports as CSV
 *
 * 4. RBAC DEMO (TC-022)
 *    - Try accessing /producer/dashboard as customer → Access Denied page
 *    - Try accessing /marketplace as producer → Access Denied page
 *
 * KEY FEATURES:
 * - Role-aware login redirects
 * - Multi-vendor cart with producer grouping
 * - Per-producer delivery dates (48hr minimum)
 * - 5% platform commission tracking
 * - Local food system badges (In Season, Organic, Year-round)
 * - Allergen warnings (prominent)
 * - Product metadata (producer, harvest date, food miles)
 * - Robust error handling (empty states, payment failures)
 * - Export functionality (CSV)
 */

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <CartProvider>
          <RouterProvider router={router} />
          <Toaster />
        </CartProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
