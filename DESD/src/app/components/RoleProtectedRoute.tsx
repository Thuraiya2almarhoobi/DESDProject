import { Navigate } from 'react-router';

import { useAuth } from '../contexts/AuthContext';
import { getAccessToken } from '../lib/tokenStorage';
import { getPortalPathForRole } from '../lib/portalConfig';
import { UserRole } from '../types';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: UserRole;
}

export function RoleProtectedRoute({ children, requiredRole }: RoleProtectedRouteProps) {
  const { user, loading } = useAuth();
  const accessToken = getAccessToken();
  const unauthenticatedRedirect = requiredRole === 'ADMIN'
    ? '/admin/login'
    : requiredRole === 'PRODUCER'
      ? '/login'
      : getPortalPathForRole(requiredRole);

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
    return <Navigate to={getPortalPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
