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
    description: 'Live commission and moderation summary',
    icon: LayoutDashboard,
  },
  {
    to: '/admin/financial-reports',
    label: 'Financial Reports',
    description: 'Auditable order and settlement reporting',
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

function getSectionSubtitle(pathname: string): string {
  if (pathname.startsWith('/admin/financial-reports') || pathname.startsWith('/admin/commission')) {
    return 'Filter reporting periods, review order-level commission detail, and export auditable results.';
  }

  return 'Monitor commission health, track recent orders, and action moderation from one workspace.';
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
  const secondaryAction = location.pathname.startsWith('/admin/financial-reports')
    ? { to: '/admin/dashboard', label: 'Open overview' }
    : { to: '/admin/financial-reports', label: 'Open reports' };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(45,92,65,0.08),_transparent_30%),linear-gradient(180deg,_#eef2ec_0%,_#f5f7f3_55%,_#eef2ed_100%)] text-[#182219]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-[#233128] bg-[linear-gradient(180deg,#18231b_0%,#111913_100%)] px-6 py-6 text-[#eef4ee] lg:flex">
        <Link to="/admin/dashboard" className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#203227] text-[#d8ead9] ring-1 ring-[#39513d]">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-[#9db69f]">DESD network</p>
            <p className="mt-1 text-lg font-semibold text-white">Admin workspace</p>
          </div>
        </Link>

        <div className="mt-8 rounded-3xl border border-[#2a3d2f] bg-[#1e2c21] p-5">
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full bg-[#2c4330] px-3 py-1 text-[#d9eedb] shadow-none hover:bg-[#2c4330]">
              Staff only
            </Badge>
            <Badge className="rounded-full bg-[#243726] px-3 py-1 text-[#b6d6b8] shadow-none hover:bg-[#243726]">
              Live finance
            </Badge>
          </div>
          <h2 className="mt-4 text-base font-semibold text-white">Commission operations</h2>
          <p className="mt-2 text-sm leading-6 text-[#b6c7b7]">
            Purpose-built admin tooling for commission oversight, reporting, and audit traceability.
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
                      ? 'border-[#44644c] bg-[#243827] text-white shadow-[0_18px_36px_rgba(5,10,7,0.26)]'
                      : 'border-[#243127] bg-[#162119] text-[#d0ddd1] hover:border-[#2f4234] hover:bg-[#1b281e]',
                  )
                }
              >
                <div className="mt-1 rounded-2xl bg-[#203227] p-2 text-[#bfe0c0] transition-colors group-hover:bg-[#29402d]">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm leading-5 text-[#afc1b1]">{item.description}</p>
                </div>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-3xl border border-[#2a3d2f] bg-[#152017] p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 border border-[#314934]">
              <AvatarFallback className="bg-[#223626] text-sm font-semibold text-[#d8ead9]">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{displayName}</p>
              <p className="truncate text-sm text-[#afc1b1]">{user?.email}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full justify-between border-[#39513d] bg-transparent text-[#dbe9dc] hover:bg-[#223626] hover:text-white"
            onClick={handleSignOut}
          >
            Sign out
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <div className="min-w-0 lg:ml-72">
        <header className="sticky top-0 z-20 w-full border-b border-[#d6ddd0] bg-[#f7f8f4]/92 backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-[#5f6d61]">
                <Activity className="size-4 text-[var(--forest-green)]" />
                DESD admin console
              </div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#182219]">{getSectionTitle(location.pathname)}</h1>
              <p className="mt-1 text-sm text-[#5f6d61]">{getSectionSubtitle(location.pathname)}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="hidden rounded-2xl border border-[#d6ddd0] bg-white px-4 py-3 text-left xl:block">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6d7c6f]">Workspace</p>
                <p className="mt-1 text-sm font-medium text-[#243127]">Commission, audit, and moderation</p>
              </div>
              <Button
                asChild
                variant="outline"
                className="border-[#c7d0c1] bg-white text-[var(--forest-green)] hover:bg-[#edf2eb] hover:text-[var(--forest-green)]"
              >
                <Link to={secondaryAction.to}>{secondaryAction.label}</Link>
              </Button>
              <Button type="button" className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

