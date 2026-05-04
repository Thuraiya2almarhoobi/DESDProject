/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable input-otp component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

"use client";

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";

import { cn } from "./utils";

/**
 * InputOTP boundary.
 *
 * This exported unit supports the file role: Provides the reusable input-otp component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

/**
 * InputOTPGroup boundary.
 *
 * This exported unit supports the file role: Provides the reusable input-otp component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  );
}

/**
 * InputOTPSlot boundary.
 *
 * This exported unit supports the file role: Provides the reusable input-otp component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm bg-input-background transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

/**
 * InputOTPSeparator boundary.
 *
 * This exported unit supports the file role: Provides the reusable input-otp component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
