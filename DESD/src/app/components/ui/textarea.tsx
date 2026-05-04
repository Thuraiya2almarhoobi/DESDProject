/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable textarea component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import * as React from "react";

import { cn } from "./utils";

/**
 * Textarea boundary.
 *
 * This exported unit supports the file role: Provides the reusable textarea component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-none placeholder:text-[#8a8174] dark:bg-input/30 flex field-sizing-content min-h-24 w-full rounded-xl border border-[#cfc3b2] bg-[#fffefa] px-3.5 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-[border-color,background-color,box-shadow] outline-none disabled:cursor-not-allowed disabled:bg-[#f4efe6] disabled:opacity-60 md:text-sm",
        "focus-visible:border-[#17653a] focus-visible:bg-white focus-visible:ring-[#17653a]/20 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
