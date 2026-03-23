import { Activity, ChartColumnBig, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../../contexts/AuthContext';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

const navigationItems = [
  {
    to: '/admin/dashboard',
    label: 'Overview',
    description: 'Commission health and audit coverage',
    icon: LayoutDashboard,
  },
  {
    to: '/admin/financial-reports',
    label: 'Financial Reports',
    description: 'Order-by-order commission reporting',
    icon: ChartColumnBig,
  },
];

function getInitials(value: string): string {
  const words = value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return 'AD';
  }

  return words.map((word) => word.charAt(0).toUpperCase()).join('');
}

function getSectionTitle(pathname: string): string {
  if (pathname.startsWith('/admin/financial-reports') || pathname.startsWith('/admin/commission')) {
    return 'Financial reports';
  }

  return 'Admin overview';
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const displayName = user?.name || user?.email || 'Admin User';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.10),_transparent_35%),linear-gradient(180deg,_#f7fbf9_0%,_#eef4f2_45%,_#f8fbfa_100%)] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-slate-200/80 bg-slate-950 px-6 py-8 text-white lg:flex">
        <Link to="/admin/dashboard" className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-300/30">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">DESD Network</p>
            <p className="text-lg font-semibold">Admin Control</p>
          </div>
        </Link>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <Badge className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-100 shadow-none hover:bg-emerald-400/15">
            Staff-only access
          </Badge>
          <h2 className="mt-4 text-xl font-semibold">Commission monitoring workspace</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Separate routing, separate login, and reporting screens focused on commission accuracy, payout traceability,
            CSV export, and period summaries.
          </p>
        </div>

        <nav className="mt-8 space-y-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'group flex items-start gap-3 rounded-3xl border px-4 py-4 transition-all',
                    isActive
                      ? 'border-emerald-300/40 bg-emerald-400/15 text-white shadow-[0_16px_40px_rgba(16,185,129,0.18)]'
                      : 'border-white/8 bg-white/4 text-slate-200 hover:border-white/15 hover:bg-white/8',
                  )
                }
              >
                <div className="mt-1 rounded-2xl bg-white/10 p-2 text-emerald-100 transition-colors group-hover:bg-white/15">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-300">{item.description}</p>
                </div>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 border border-white/15">
              <AvatarFallback className="bg-emerald-500/20 text-sm font-semibold text-emerald-100">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{displayName}</p>
              <p className="truncate text-sm text-slate-300">{user?.email}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full justify-between border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={handleSignOut}
          >
            Sign out
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Activity className="size-4 text-emerald-600" />
                Separate administrator workspace
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">{getSectionTitle(location.pathname)}</h1>
              <p className="mt-1 text-sm text-slate-600">
                Pre-registered administrators can audit 5% network commission totals without entering the public
                marketplace flow.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link to="/admin/financial-reports">Open reports</Link>
              </Button>
              <Button type="button" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
