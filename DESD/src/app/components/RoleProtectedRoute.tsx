import { Navigate } from 'react-router';

import { useAuth } from '../contexts/AuthContext';
import { getAccessToken } from '../lib/tokenStorage';
import { getDashboardPathForRole } from '../lib/roleRouting';
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
