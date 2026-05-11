import { cn } from "@/lib/utils";

type MarqueeProps = {
  items: string[];
  size?: "sm" | "md";
  className?: string;
};

export function Marquee({ items, size = "md", className }: MarqueeProps) {
  const repeated = [...items, ...items];

  return (
    <div className={cn("overflow-hidden whitespace-nowrap", className)}>
      <div className="marquee-track inline-flex min-w-full items-center gap-8">
        {repeated.map((item, index) => (
          <span
            key={`${item}-${index}`}
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
