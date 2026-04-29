import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[140px] w-full rounded-[24px] border border-black/10 bg-white/85 px-4 py-3 text-sm outline-none transition focus:border-black/30 focus:ring-2 focus:ring-cyan/40",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
