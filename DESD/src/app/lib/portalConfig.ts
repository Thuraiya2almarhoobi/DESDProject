import {
  Building2,
  ChefHat,
  ShieldCheck,
  ShoppingBag,
  Tractor,
  type LucideIcon,
} from 'lucide-react';

import { UserRole } from '../types';

export type PortalRole = UserRole;
export type SelfServiceRole = Exclude<UserRole, 'ADMIN'>;

export interface PortalDefinition {
  role: PortalRole;
  title: string;
  shortTitle: string;
  audience: string;
  portalHeading: string;
  portalDescription: string;
  loginHeading: string;
  loginDescription: string;
  registerHeading?: string;
  registerDescription?: string;
  portalPath: string;
  loginPath: string;
  registerPath?: string;
  landingCta: string;
  loginButtonLabel: string;
  registerButtonLabel?: string;
  highlight: string;
  accentClassName: string;
  icon: LucideIcon;
}

export const portalDefinitions: PortalDefinition[] = [
  {
    role: 'CUSTOMER',
    title: 'Customer Portal',
    shortTitle: 'Customer',
    audience: 'Individual buyers and families',
    portalHeading: 'Customer buying portal',
    portalDescription:
      'Browse seasonal produce, manage mixed-basket orders, and buy directly from trusted local suppliers.',
    loginHeading: 'Customer login',
    loginDescription:
      'Access your customer account to browse produce, review previous orders, and complete checkout.',
    registerHeading: 'Create a customer account',
    registerDescription:
      'Register as a customer to browse local produce, save your delivery details, and place marketplace orders.',
    portalPath: '/portal/customer',
    loginPath: '/login/customer',
    registerPath: '/register/customer',
    landingCta: 'Continue as Customer',
    loginButtonLabel: 'Customer Login',
    registerButtonLabel: 'Create Customer Account',
    highlight: 'Shop local produce with transparent delivery and producer information.',
    accentClassName: 'from-[oklch(0.97_0.03_145)] to-white border-[oklch(0.85_0.03_145)]',
    icon: ShoppingBag,
  },
  {
    role: 'PRODUCER',
    title: 'Producer Portal',
    shortTitle: 'Producer',
    audience: 'Farmers and suppliers',
    portalHeading: 'Producer operations portal',
    portalDescription:
      'Manage product listings, monitor incoming orders, and keep inventory and payout visibility in one place.',
    loginHeading: 'Producer login',
    loginDescription:
      'Sign in as a producer to manage stock, review order activity, and track settlement reporting.',
    registerHeading: 'Create a producer account',
    registerDescription:
      'Register your farm or supply business so you can list products and receive marketplace orders.',
    portalPath: '/portal/producer',
    loginPath: '/login/producer',
    registerPath: '/register/producer',
    landingCta: 'Continue as Producer',
    loginButtonLabel: 'Producer Login',
    registerButtonLabel: 'Create Producer Account',
    highlight: 'List products, manage supply, and receive direct producer orders.',
    accentClassName: 'from-[oklch(0.96_0.04_145)] to-[oklch(0.99_0.01_145)] border-[oklch(0.82_0.05_145)]',
    icon: Tractor,
  },
  {
    role: 'COMMUNITY',
    title: 'Community Portal',
    shortTitle: 'Community',
    audience: 'Schools, charities, and community groups',
    portalHeading: 'Community bulk-order portal',
    portalDescription:
      'Coordinate large multi-producer orders for institutions, projects, and local food programmes.',
    loginHeading: 'Community login',
    loginDescription:
      'Access community bulk ordering, supplier coordination details, and delivery instructions for institutional orders.',
    registerHeading: 'Register a community group',
    registerDescription:
      'Create a community group account for schools, charities, and other organisations placing bulk local food orders.',
    portalPath: '/portal/community',
    loginPath: '/login/community',
    registerPath: '/register/community',
    landingCta: 'Continue as Community',
    loginButtonLabel: 'Community Login',
    registerButtonLabel: 'Register a Community Group',
    highlight: 'Place coordinated bulk orders across multiple producers with delivery notes.',
    accentClassName: 'from-[oklch(0.97_0.02_160)] to-[oklch(0.99_0.01_145)] border-[oklch(0.83_0.04_160)]',
    icon: Building2,
  },
  {
    role: 'RESTAURANT',
    title: 'Restaurant Portal',
    shortTitle: 'Restaurant',
    audience: 'Business buyers with recurring demand',
    portalHeading: 'Restaurant recurring-order portal',
    portalDescription:
      'Build multi-producer order templates, schedule recurring supply runs, and manage next-instance overrides.',
    loginHeading: 'Restaurant login',
    loginDescription:
      'Sign in to manage recurring supplier templates, upcoming deliveries, and restaurant order scheduling.',
    registerHeading: 'Register a restaurant account',
    registerDescription:
      'Create a restaurant account for scheduled multi-producer ordering and recurring delivery management.',
    portalPath: '/portal/restaurant',
    loginPath: '/login/restaurant',
    registerPath: '/register/restaurant',
    landingCta: 'Continue as Restaurant',
    loginButtonLabel: 'Restaurant Login',
    registerButtonLabel: 'Register a Restaurant Account',
    highlight: 'Create repeatable order templates and manage supply continuity week to week.',
    accentClassName: 'from-[oklch(0.97_0.02_60)] to-[oklch(0.99_0.01_30)] border-[oklch(0.85_0.03_60)]',
    icon: ChefHat,
  },
  {
    role: 'ADMIN',
    title: 'Admin Portal',
    shortTitle: 'Admin',
    audience: 'Platform staff and reporting users',
    portalHeading: 'Admin reporting portal',
    portalDescription:
      'Review commission calculations, export financial reports, and monitor multi-vendor payout accuracy.',
    loginHeading: 'Admin login',
    loginDescription:
      'Use staff credentials to access commission reporting, monthly summaries, and network payout drilldowns.',
    portalPath: '/portal/admin',
    loginPath: '/login/admin',
    landingCta: 'Admin Login',
    loginButtonLabel: 'Admin Login',
    highlight: 'Monitor 5 percent commission reporting and export auditable financial summaries.',
    accentClassName: 'from-[oklch(0.96_0.02_250)] to-[oklch(0.99_0.01_260)] border-[oklch(0.82_0.03_250)]',
    icon: ShieldCheck,
  },
];

export function getPortalDefinition(role: PortalRole): PortalDefinition {
  const definition = portalDefinitions.find((entry) => entry.role === role);
  if (!definition) {
    throw new Error(`Missing portal definition for role ${role}.`);
  }
  return definition;
}

export function getPortalPathForRole(role: PortalRole): string {
  return getPortalDefinition(role).portalPath;
}

export function getLoginPathForRole(role: PortalRole): string {
  return getPortalDefinition(role).loginPath;
}

export function getRegisterPathForRole(role: SelfServiceRole): string {
  const definition = getPortalDefinition(role);
  if (!definition.registerPath) {
    throw new Error(`Role ${role} does not have a public registration route.`);
  }
  return definition.registerPath;
}
