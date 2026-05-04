/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable RoleProtectedRoute component used by pages or layout shells.
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
import { getAccessToken } from '../lib/tokenStorage';
import { getDashboardPathForRole } from '../lib/roleRouting';
import { UserRole } from '../types';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: UserRole;
}

/**
 * RoleProtectedRoute boundary.
 *
 * This exported unit supports the file role: Provides the reusable RoleProtectedRoute component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function RoleProtectedRoute({ children, requiredRole }: RoleProtectedRouteProps) {
  const { user, loading } = useAuth();
  const accessToken = getAccessToken();
  const unauthenticatedRedirect = requiredRole === 'ADMIN'
    ? '/admin/login'
    : '/login';

  if (!accessToken) {
    return <Navigate to={unauthenticatedRedirect} replace />;
  }

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to={unauthenticatedRedirect} replace />;
  }

  if (user.role !== requiredRole) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
