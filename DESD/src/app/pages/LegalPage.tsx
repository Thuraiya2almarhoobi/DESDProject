/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements public legal document pages for prototype terms and privacy copy.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 */

import { AlertTriangle, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

import { Reveal, RevealGroup } from '../components/motion/Motion';
import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';

type LegalPageKind = 'terms' | 'privacy';

interface LegalSection {
  title: string;
  body: string[];
}

const termsSections: LegalSection[] = [
  {
    title: 'Using the marketplace responsibly',
    body: [
      'Users must not use Local Food Marketplace for scams, fraud, impersonation, spam, harassment, malware, or any unlawful activity.',
      'Users must not upload or share inappropriate, offensive, misleading, unsafe, rights-infringing, or illegal content.',
    ],
  },
  {
    title: 'Product and listing standards',
    body: [
      'Producers should provide honest product names, origin details, prices, stock levels, allergen information, and fulfilment timings.',
      'Customers, restaurants, and community buyers should provide accurate contact, delivery, and order information.',
    ],
  },
  {
    title: 'Orders and accounts',
    body: [
      'Accounts should only be used by the person or organisation they represent. Login details should be kept secure.',
      'Orders should be placed in good faith. Misuse of checkout, delivery, payment, or review features may lead to account restriction.',
    ],
  },
  {
    title: 'Moderation and safety',
    body: [
      'The platform may remove content, pause listings, restrict accounts, or investigate behaviour that appears unsafe, fraudulent, inappropriate, or harmful.',
      'This student prototype does not replace professional food safety, consumer protection, contract, or trading standards advice.',
    ],
  },
];

const privacySections: LegalSection[] = [
  {
    title: 'Data we may collect',
    body: [
      'The prototype may collect account details, role profile details, contact information, delivery addresses, order history, product listing data, and basic technical or security logs.',
      'We aim to collect only the information needed to run the marketplace flow, demonstrate role-based features, and keep the prototype secure.',
    ],
  },
  {
    title: 'How data is used',
    body: [
      'Data is used for registration, sign-in, order handling, delivery coordination, producer fulfilment, support, fraud prevention, security, and project demonstration.',
      'Relevant order and delivery information may be visible to the producers, restaurants, community buyers, or platform staff involved in fulfilment.',
    ],
  },
  {
    title: 'UK data protection thinking',
    body: [
      'This prototype is written with UK GDPR and the Data Protection Act 2018 in mind, including transparency, purpose limitation, data minimisation, accuracy, storage limitation, and security.',
      'Data minimisation means only asking for information that is needed for the account, order, delivery, safety, or support purpose being shown.',
    ],
  },
  {
    title: 'Your privacy rights',
    body: [
      'In a real service, users would be able to ask to access, correct, delete, restrict, or object to certain uses of their personal data, subject to lawful limits.',
      'Users would also be able to raise concerns with the UK Information Commissioner\'s Office. This page is prototype wording and not a final legal privacy notice.',
    ],
  },
];

const pageContent = {
  terms: {
    eyebrow: 'Terms and Conditions',
    title: 'Prototype marketplace terms',
    description:
      'Simple student-project terms for safe, honest, and responsible use of Local Food Marketplace.',
    icon: FileText,
    sections: termsSections,
  },
  privacy: {
    eyebrow: 'Privacy Policy',
    title: 'Prototype privacy policy',
    description:
      'A concise student-project privacy notice showing how the marketplace has considered UK data protection principles.',
    icon: LockKeyhole,
    sections: privacySections,
  },
} satisfies Record<LegalPageKind, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof FileText;
  sections: LegalSection[];
}>;

interface LegalPageProps {
  kind: LegalPageKind;
}

export function LegalPage({ kind }: LegalPageProps) {
  const content = pageContent[kind];
  const Icon = content.icon;
  const alternateLink = kind === 'terms' ? '/privacy' : '/terms';
  const alternateLabel = kind === 'terms' ? 'View Privacy Policy' : 'View Terms and Conditions';

  return (
    <div className="market-page min-h-screen">
      <SiteHeader />

      <main>
        <section className="market-section market-section-cream">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-18">
            <RevealGroup className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end" stagger={0.1}>
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--forest-green)_18%,white)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--forest-green)] shadow-sm">
                  <Icon className="size-4" />
                  {content.eyebrow}
                </span>
                <div className="space-y-4">
                  <h1 className="market-section-title max-w-4xl text-[oklch(0.23_0.034_87)]">{content.title}</h1>
                  <p className="market-copy max-w-2xl">{content.description}</p>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-[#e4e1d8] bg-white/82 p-5 shadow-[0_18px_42px_rgba(18,28,20,0.08)] backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[oklch(0.52_0.09_75)]" />
                  <div className="space-y-2">
                    <p className="font-semibold text-[oklch(0.24_0.03_95)]">Student project notice</p>
                    <p className="text-sm leading-6 text-[oklch(0.38_0.03_95)]">
                      This is dummy legal content created for a student prototype. It shows legal and ethical thinking, but it
                      has not been drafted or reviewed by legal professionals.
                    </p>
                  </div>
                </div>
              </div>
            </RevealGroup>
          </div>
        </section>

        <section className="market-section market-section-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
            <RevealGroup className="grid gap-5 md:grid-cols-2" stagger={0.08}>
              {content.sections.map((section) => (
                <article key={section.title} className="rounded-[1.15rem] border border-[#e4e1d8] bg-[#fffdf8] p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--forest-green)_10%,white)] text-[var(--forest-green)]">
                      <ShieldCheck className="size-4" />
                    </span>
                    <h2 className="text-xl font-semibold text-[oklch(0.24_0.03_95)]">{section.title}</h2>
                  </div>
                  <div className="space-y-3">
                    {section.body.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-7 text-[oklch(0.38_0.03_95)]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </RevealGroup>

            <Reveal className="mt-8 rounded-[1.35rem] border border-[color-mix(in_srgb,var(--forest-green)_18%,white)] bg-[color-mix(in_srgb,var(--forest-green)_6%,white)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--forest-green)]">Last updated: 5 May 2026</p>
                  <p className="mt-1 text-sm leading-6 text-[oklch(0.38_0.03_95)]">
                    For a real launch, this page should be replaced with professionally reviewed legal documents.
                  </p>
                </div>
                <Button asChild variant="outline" className="market-button-outline bg-white/65">
                  <Link to={alternateLink}>{alternateLabel}</Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </div>
  );
}
