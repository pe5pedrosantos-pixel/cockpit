import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Rótulos discretos. Só "attention" usa coral — nada mais na interface
 * pode competir com esse sinal.
 */
const styles: Record<string, string> = {
  default: "bg-black/[0.05] text-ink-muted",
  primary: "bg-navy/10 text-navy",
  success: "bg-money/10 text-money",
  warning: "bg-attention-bg text-coral",
  danger: "bg-attention-bg text-coral",
  outline: "border border-border-strong text-ink-muted",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof styles }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        styles[tone],
        className
      )}
      {...props}
    />
  );
}
