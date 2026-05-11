import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full border-2 border-foreground/20 bg-background px-4 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
