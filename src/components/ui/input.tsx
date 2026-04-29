import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-2xl border border-black/10 bg-white/85 px-4 py-2 text-sm outline-none transition focus:border-black/30 focus:ring-2 focus:ring-cyan/40",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
