/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the PortalSelectPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';

import { AnimatedText, Reveal, RevealGroup } from '../../components/motion/Motion';
import { SiteHeader } from '../../components/SiteHeader';
import { Button } from '../../components/ui/button';
import { getPortalDefinition, getRegisterPathForRole } from '../../lib/portalConfig';

const selectableRoles = ['CUSTOMER', 'RESTAURANT', 'COMMUNITY'] as const;

const roleCopy = {
  CUSTOMER: {
    description: 'For households and individual buyers ordering seasonal produce from local suppliers.',
    points: ['Browse local products', 'Save delivery details', 'Track personal orders'],
  },
  RESTAURANT: {
    description: 'For kitchens and food businesses that need repeatable ordering and supplier continuity.',
    points: ['Build supplier baskets', 'Plan recurring orders', 'Manage kitchen supply'],
  },
  COMMUNITY: {
    description: 'For schools, charities, and community groups coordinating larger local food orders.',
    points: ['Coordinate bulk orders', 'Add delivery notes', 'Organise group purchasing'],
  },
} as const;

/**
 * PortalSelectPage boundary.
 *
 * This exported unit supports the file role: Implements the PortalSelectPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function PortalSelectPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedMode = searchParams.get('mode');

  if (requestedMode === 'login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f8faf5_0%,#eef2e8_100%)]">
      <SiteHeader />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute right-[-10rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(79,176,127,0.12)_0%,transparent_70%)]" />
        <div className="absolute bottom-[-9rem] left-[-8rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(45,80,22,0.08)_0%,transparent_70%)]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-7.8rem)] w-full max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <RevealGroup as="section" className="mx-auto w-full max-w-4xl text-center" stagger={0.1}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--earth-accent)]">
            Create an account
          </p>
          <AnimatedText
            as="h1"
            text="Choose how you want to use the marketplace."
            className="mt-3 text-3xl font-semibold tracking-tight text-[var(--rich-soil)] sm:text-4xl"
          />
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--warm-earth)] sm:text-base">
            Select the role that best matches your ordering needs. Each path keeps the same secure
            account system with a tailored registration form.
          </p>
        </RevealGroup>

        <RevealGroup as="section" className="mt-10 grid w-full gap-5 md:grid-cols-3" stagger={0.16} delayChildren={0.1} amount={0.24}>
          {selectableRoles.map((role) => {
            const portal = getPortalDefinition(role);
/**
 * Icon boundary.
 *
 * This exported unit supports the file role: Implements the PortalSelectPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
            const Icon = portal.icon;
            const targetPath = getRegisterPathForRole(role);
            const copy = roleCopy[role];

            return (
              <Link
                key={role}
                to={targetPath}
                className="group relative flex min-h-[27rem] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/92 p-6 shadow-[0_18px_50px_rgba(31,56,16,0.08)] backdrop-blur-sm transition-[border-color,box-shadow,transform,background-color] duration-500 ease-out hover:-translate-y-1 hover:border-[rgba(45,80,22,0.38)] hover:bg-white hover:shadow-[0_28px_70px_rgba(31,56,16,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(79,176,127,0.5),transparent)]" />
                <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[rgba(79,176,127,0.08)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

                <div className="relative flex size-13 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(45,80,22,0.1),rgba(79,176,127,0.12))] text-[var(--forest-green)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform duration-500 ease-out group-hover:scale-105">
                  <Icon className="size-6" />
                </div>

                <div className="relative mt-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--earth-accent)]">
                    {portal.shortTitle}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--rich-soil)]">
                    {portal.shortTitle}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-[var(--warm-earth)]">{copy.description}</p>
                </div>

                <div className="relative mt-6 space-y-3">
                  {copy.points.map((point) => (
                    <div key={point} className="flex items-start gap-3 text-sm text-[var(--rich-soil)]">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--forest-green)]" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>

                <div className="relative mt-auto pt-8">
                  <span className="inline-flex w-full items-center justify-between rounded-xl bg-[var(--forest-green)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(45,80,22,0.16)] transition-[box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_30px_rgba(45,80,22,0.22)]">
                    Continue
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </RevealGroup>

        <Reveal as="section" className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center justify-center gap-3 text-center text-sm text-[var(--warm-earth)] sm:flex-row" delay={0.16}>
          <span>Already have an account?</span>
          <Button asChild variant="outline" className="border-[#d8d0c0] bg-[#fffdf8]">
            <Link to="/login">Sign in</Link>
          </Button>
          <span className="hidden text-[#cfc6b5] sm:inline">|</span>
          <Link
            to="/register/producer"
            className="font-semibold text-[var(--forest-green)] underline underline-offset-4"
          >
            Joining as a producer?
          </Link>
        </Reveal>
      </main>
    </div>
  );
}
