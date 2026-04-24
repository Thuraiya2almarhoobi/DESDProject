import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../../contexts/AuthContext';
import { getDashboardPathForRole } from '../../lib/roleRouting';
import { LoginPage } from '../LoginPage';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [loading, navigate, user]);

  return <LoginPage />;
}
