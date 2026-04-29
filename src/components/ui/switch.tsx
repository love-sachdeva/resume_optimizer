import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  className
}: SwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full border border-black/10 transition",
        checked ? "bg-ink" : "bg-black/10",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
