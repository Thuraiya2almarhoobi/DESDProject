/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides subtle, reusable motion primitives for page and content reveals.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 */

import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { Outlet, useLocation } from 'react-router';

import { cn } from '../ui/utils';

export const motionTiming = {
  easeOut: [0.16, 1, 0.3, 1],
  pageDuration: 0.12,
  sectionDuration: 0.9,
  cardDuration: 0.78,
} as const;

export const motionVariants = {
  page: {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 1, y: 0 },
  },
  section: {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
  },
  card: {
    initial: { opacity: 0, y: 16, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
  },
  listItem: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
  },
  modalPanel: {
    initial: { opacity: 0, y: 18, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
  },
} satisfies Record<string, Variants>;

type MotionTag = 'div' | 'main' | 'section' | 'article' | 'aside' | 'ul' | 'li';
type TextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span';

const motionElements = {
  div: motion.div,
  main: motion.main,
  section: motion.section,
  article: motion.article,
  aside: motion.aside,
  ul: motion.ul,
  li: motion.li,
};

const motionTextElements = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
};

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: MotionTag;
  delay?: number;
  once?: boolean;
  amount?: number;
  variant?: keyof typeof motionVariants;
}

export function Reveal({
  as = 'div',
  className,
  delay = 0,
  once = true,
  amount = 0.22,
  variant = 'section',
  children,
  ...props
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const MotionElement = motionElements[as];
  const selectedVariant = motionVariants[variant];

  if (prefersReducedMotion) {
    return React.createElement(as, { className, ...props }, children);
  }

  const revealedChildren = React.Children.map(children, (child) => (
    <motion.div
      variants={motionVariants.listItem}
      transition={{ duration: 0.78, ease: motionTiming.easeOut }}
      style={{ willChange: 'opacity, transform' }}
    >
      {child}
    </motion.div>
  ));

  return (
    <MotionElement
      className={className}
      variants={selectedVariant}
      initial="initial"
      whileInView="animate"
      viewport={{ once, amount, margin: '0px 0px -8% 0px' }}
      transition={{
        duration: variant === 'card' ? motionTiming.cardDuration : motionTiming.sectionDuration,
        ease: motionTiming.easeOut,
        delay,
      }}
      {...props}
    >
      {revealedChildren}
    </MotionElement>
  );
}

interface RevealGroupProps extends React.HTMLAttributes<HTMLElement> {
  as?: MotionTag;
  stagger?: number;
  delayChildren?: number;
  once?: boolean;
  amount?: number;
}

export function RevealGroup({
  as = 'div',
  className,
  stagger = 0.12,
  delayChildren = 0,
  once = true,
  amount = 0.18,
  children,
  ...props
}: RevealGroupProps) {
  const prefersReducedMotion = useReducedMotion();
  const MotionElement = motionElements[as];

  if (prefersReducedMotion) {
    return React.createElement(as, { className, ...props }, children);
  }

  const revealedChildren = React.Children.map(children, (child) => (
    <motion.div
      className="min-w-0"
      variants={motionVariants.listItem}
      transition={{ duration: 0.82, ease: motionTiming.easeOut }}
      style={{ willChange: 'opacity, transform' }}
    >
      {child}
    </motion.div>
  ));

  return (
    <MotionElement
      className={className}
      initial="initial"
      whileInView="animate"
      viewport={{ once, amount, margin: '0px 0px -8% 0px' }}
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: stagger,
            delayChildren,
          },
        },
      }}
      {...props}
    >
      {revealedChildren}
    </MotionElement>
  );
}

interface AnimatedTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: TextTag;
  text: string;
  delay?: number;
  stagger?: number;
  amount?: number;
  once?: boolean;
}

export function AnimatedText({
  as = 'h2',
  text,
  className,
  delay = 0,
  stagger = 0.055,
  amount = 0.35,
  once = true,
  ...props
}: AnimatedTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const MotionText = motionTextElements[as];
  const words = text.split(/(\s+)/);

  if (prefersReducedMotion) {
    return React.createElement(as, { className, ...props }, text);
  }

  return (
    <MotionText
      className={className}
      initial="initial"
      whileInView="animate"
      viewport={{ once, amount }}
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
      {...props}
    >
      {words.map((word, index) =>
        word.trim() ? (
          <motion.span
            key={`${word}-${index}`}
            className="inline-block"
            variants={{
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.86, ease: motionTiming.easeOut }}
            style={{ willChange: 'opacity, transform' }}
          >
            {word}
          </motion.span>
        ) : (
          word
        ),
      )}
    </MotionText>
  );
}

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn('min-w-0', className)}
      initial={prefersReducedMotion ? { opacity: 0 } : motionVariants.page.initial}
      animate={prefersReducedMotion ? { opacity: 1 } : motionVariants.page.animate}
      transition={{
        duration: prefersReducedMotion ? 0.01 : 0.24,
        ease: motionTiming.easeOut,
      }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedOutlet() {
  const location = useLocation();

  return (
    <PageTransition key={location.pathname}>
      <Outlet />
    </PageTransition>
  );
}
