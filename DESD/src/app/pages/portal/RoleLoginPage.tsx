import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { PublicPortalShell } from '../../components/portal/PublicPortalShell';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { getPortalDefinition, PortalRole } from '../../lib/portalConfig';
import { getDashboardPathForRole } from '../../lib/roleRouting';

interface RoleLoginPageProps {
  role: PortalRole;
}

interface LoginLocationState {
  message?: string;
}

export function RoleLoginPage({ role }: RoleLoginPageProps) {
  const definition = getPortalDefinition(role);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, user, loading } = useAuth();
  const state = (location.state ?? null) as LoginLocationState | null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user?.role === role) {
      navigate(getDashboardPathForRole(role), { replace: true });
    }
  }, [loading, navigate, role, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password, rememberMe);

    if (!result.success) {
      setError(result.error || 'Login failed');
      setSubmitting(false);
      return;
    }

    if (result.user.role !== role) {
      logout();
      setError(`This account is not a ${definition.shortTitle.toLowerCase()} account. Please use the correct portal.`);
      setSubmitting(false);
      return;
    }

    toast.success('Login successful');
    navigate(getDashboardPathForRole(role), { replace: true });
  };

  return (
    <PublicPortalShell
      eyebrow={`${definition.shortTitle} Login`}
      title={definition.loginHeading}
      description={definition.loginDescription}
      accentClassName={definition.accentClassName}
      backHref={definition.portalPath}
      backLabel="Back to Portal"
      insight="The same backend authentication endpoint is used here. This page only admits the stakeholder role that matches this portal."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[oklch(0.24_0.02_145)]">Portal access</p>
          <p className="text-sm leading-6 text-[oklch(0.36_0.03_145)]">
            Enter the credentials for your {definition.shortTitle.toLowerCase()} account. If the returned role does not
            match this portal, the sign-in will be rejected on the client side.
          </p>
        </div>

        {state?.message ? (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${role}-email`}>Email</Label>
            <Input
              id={`${role}-email`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${role}-password`}>Password</Label>
            <div className="relative">
              <Input
                id={`${role}-password`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="pr-11"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <label className="inline-flex items-center gap-2 text-[oklch(0.32_0.03_145)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember me</span>
            </label>

            <Link to="/forgot-password" className="text-[oklch(0.42_0.08_145)] hover:underline">
              Forgot password?
            </Link>
          </div>

          <div className="grid gap-3">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Signing in...' : definition.loginButtonLabel}
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to={definition.portalPath}>Back to Portal</Link>
            </Button>
          </div>
        </form>
      </div>
    </PublicPortalShell>
  );
}
