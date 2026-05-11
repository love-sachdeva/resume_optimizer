import { cn } from "@/lib/utils";

export function Progress({
  value,
  className
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden border border-foreground/20 bg-background",
        className
      )}
    >
      <div
        className="h-full bg-primary transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
