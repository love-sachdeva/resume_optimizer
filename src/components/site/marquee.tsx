import { cn } from "@/lib/utils";

type MarqueeProps = {
  items: string[];
  size?: "sm" | "md";
  className?: string;
};

export function Marquee({ items, size = "md", className }: MarqueeProps) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6">
        {items.map((item) => (
          <span
            key={item}
            className={cn(
              "mono uppercase tracking-[0.22em] text-foreground/55",
              size === "sm" ? "text-[11px]" : "text-sm"
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
