import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border-2 border-primary bg-primary text-primary-foreground hover:border-foreground hover:bg-foreground hover:text-background",
  secondary:
    "border-2 border-foreground bg-foreground text-background hover:border-primary hover:bg-primary hover:text-primary-foreground",
  ghost: "bg-transparent text-foreground hover:bg-foreground hover:text-background",
  outline:
    "border-2 border-foreground bg-transparent text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition duration-200 disabled:pointer-events-none disabled:opacity-50",
          "mono uppercase tracking-[0.16em]",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
