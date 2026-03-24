import { BarChart3, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { SiteHeader } from '../../components/SiteHeader';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, logout, user, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user?.role === 'ADMIN') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [loading, navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password, rememberMe);

    if (!result.success) {
      setError(result.error || 'Admin login failed');
      setSubmitting(false);
      return;
    }

    if (result.user.role !== 'ADMIN') {
      logout();
      setError('This account is not provisioned for administrator access. Please use the correct portal.');
      setSubmitting(false);
      return;
    }

    toast.success('Administrator access granted');
    navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.18),_transparent_30%),linear-gradient(135deg,_#08110f_0%,_#0f172a_52%,_#122c22_100%)] text-white">
      <SiteHeader showNavigation={false} />
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-[0_32px_90px_rgba(2,6,23,0.38)] backdrop-blur-xl sm:p-10 lg:p-12">
          <Badge className="rounded-full bg-emerald-400/15 px-4 py-1 text-xs uppercase tracking-[0.35em] text-emerald-100 shadow-none hover:bg-emerald-400/15">
            Administrator access
          </Badge>
          <h1 className="mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Separate financial oversight for network administrators.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            This login is isolated from the public marketplace flow and is reserved for pre-registered admin accounts
            who need commission monitoring, export-ready reporting, and payout verification tools.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5">
              <ShieldCheck className="size-8 text-emerald-300" />
              <h2 className="mt-4 text-lg font-semibold">Pre-registered only</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Admin accounts are provisioned in the database. There is no public registration path for admin users.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5">
              <BarChart3 className="size-8 text-cyan-300" />
              <h2 className="mt-4 text-lg font-semibold">Financial reporting</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Review previous two-week totals, monthly summaries, year-to-date commission, and CSV exports.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5">
              <LockKeyhole className="size-8 text-amber-300" />
              <h2 className="mt-4 text-lg font-semibold">Role-gated routing</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Successful admin sign-in routes to a dedicated admin workspace, not the customer marketplace.
              </p>
            </div>
          </div>
        </section>

        <Card className="border-white/10 bg-white/96 text-slate-900 shadow-[0_32px_90px_rgba(2,6,23,0.34)]">
          <CardHeader className="space-y-3 pb-4">
            <Badge className="w-fit rounded-full bg-slate-950 px-3 py-1 text-white shadow-none hover:bg-slate-950">
              Admin sign in
            </Badge>
            <CardTitle className="text-3xl">Access the admin workspace</CardTitle>
            <CardDescription className="text-base leading-7 text-slate-600">
              Use an existing administrator email and password. Marketplace customer, producer, community, and
              restaurant registrations remain unchanged and separate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user && user.role !== 'ADMIN' ? (
              <Alert className="mb-5 border-amber-200 bg-amber-50 text-amber-950">
                <AlertDescription>
                  You are currently signed in as {user.role.toLowerCase()}. Signing in here will switch you to an admin
                  account.
                </AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your administrator password"
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

              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember this device</span>
              </label>

              <div className="grid gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                  disabled={submitting}
                >
                  {submitting ? 'Signing in...' : 'Enter admin workspace'}
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/">Back to marketplace</Link>
                </Button>
              </div>
            </form>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Financial admins are provisioned directly in the database seed data. No admin registration UI is exposed.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
