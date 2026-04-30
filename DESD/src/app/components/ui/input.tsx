import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[#8a8174] selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-11 w-full min-w-0 rounded-xl border border-[#cfc3b2] bg-[#fffefa] px-3.5 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-[border-color,background-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#f4efe6] disabled:opacity-60 md:text-sm",
        "focus-visible:border-[#17653a] focus-visible:bg-white focus-visible:ring-[#17653a]/20 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
