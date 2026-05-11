import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-1 border border-foreground/25 bg-background px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground/65",
        className
      )}
      {...props}
    />
  );
}
