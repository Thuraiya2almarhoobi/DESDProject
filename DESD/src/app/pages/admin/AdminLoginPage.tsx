/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the AdminLoginPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../../contexts/AuthContext';
import { getDashboardPathForRole } from '../../lib/roleRouting';
import { LoginPage } from '../LoginPage';

/**
 * AdminLoginPage boundary.
 *
 * This exported unit supports the file role: Implements the AdminLoginPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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
