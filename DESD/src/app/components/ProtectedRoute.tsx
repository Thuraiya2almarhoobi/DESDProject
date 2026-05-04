/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable ProtectedRoute component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { getPendingCustomerPreviewExitTarget } from '../lib/customerPreview';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * ProtectedRoute boundary.
 *
 * This exported unit supports the file role: Provides the reusable ProtectedRoute component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const pendingProducerPreviewExitTarget = getPendingCustomerPreviewExitTarget();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'PRODUCER' && pendingProducerPreviewExitTarget) {
      return <Navigate to={pendingProducerPreviewExitTarget} replace />;
    }
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
