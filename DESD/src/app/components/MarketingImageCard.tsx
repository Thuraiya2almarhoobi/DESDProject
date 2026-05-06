/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable MarketingImageCard component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from './ui/utils';

type MarketingImageCardProps = {
  image: string;
  alt: string;
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  className?: string;
  imagePosition?: string;
  minHeightClassName?: string;
  bodyClassName?: string;
};

/**
 * MarketingImageCard boundary.
 *
 * This exported unit supports the file role: Provides the reusable MarketingImageCard component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function MarketingImageCard({
  image,
  alt,
  label,
  title,
  body,
  icon: Icon,
  className,
  imagePosition = 'object-center',
  minHeightClassName = 'min-h-[20rem]',
  bodyClassName,
}: MarketingImageCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.article
      className={cn(
        'relative overflow-hidden rounded-[1.35rem] border border-white/20 bg-[oklch(0.21_0.028_124)] shadow-[0_18px_38px_rgba(18,28,20,0.12)]',
        minHeightClassName,
        className,
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.img
        src={image}
        alt={alt}
        loading="lazy"
        className={cn('absolute inset-0 h-full w-full object-cover', imagePosition)}
        initial={prefersReducedMotion ? false : { scale: 1.035, opacity: 0.72 }}
        whileInView={prefersReducedMotion ? undefined : { scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.24 }}
        transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,31,20,0.24)_0%,rgba(15,31,20,0.48)_45%,rgba(15,31,20,0.88)_100%)]" />
      <motion.div
        className="relative z-10 flex h-full flex-col justify-between p-5 text-white"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.24 }}
        transition={{ duration: 0.68, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/14 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/92 backdrop-blur-sm">
            {label}
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(9,29,17,0.58)] text-white backdrop-blur-sm">
            <Icon className="size-4.5" />
          </span>
        </div>

        <div className="space-y-3">
          <h3 className="text-2xl font-semibold tracking-tight text-white">{title}</h3>
          <p className={cn('max-w-md text-sm leading-7 text-white/82', bodyClassName)}>{body}</p>
        </div>
      </motion.div>
    </motion.article>
  );
}
