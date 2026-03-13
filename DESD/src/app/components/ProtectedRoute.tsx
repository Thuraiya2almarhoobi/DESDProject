import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { getPendingCustomerPreviewExitTarget } from '../lib/customerPreview';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

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
