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

  if (!accessToken) {
    return <Navigate to={getPortalPathForRole(requiredRole)} replace />;
  }

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to={getPortalPathForRole(requiredRole)} replace />;
  }

  if (user.role !== requiredRole) {
    return <Navigate to={getPortalPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
