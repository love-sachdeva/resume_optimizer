import { cn } from "@/lib/utils";

type SectionLabelProps = {
  index?: string;
  children: React.ReactNode;
  className?: string;
};

export function SectionLabel({ index, children, className }: SectionLabelProps) {
  return (
    <div className={cn("mono flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-foreground/65", className)}>
      {index ? <span className="text-primary">{index}</span> : null}
      <span>{children}</span>
    </div>
  );
}
