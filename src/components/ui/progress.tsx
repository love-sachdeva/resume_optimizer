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
        "h-2.5 w-full overflow-hidden rounded-full bg-black/10",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan via-gold to-salmon transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
