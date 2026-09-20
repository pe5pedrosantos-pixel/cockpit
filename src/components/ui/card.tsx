import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Superfície de papel sobre o fundo creme.
 * Sem sombra: a hierarquia vem do tamanho e do espaço, não de camadas.
 */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-paper", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 px-5 pb-1 pt-4", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-[13px] font-semibold tracking-tight text-ink",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-4 pt-2", className)} {...props} />;
}

/**
 * Número em destaque com seu rótulo abaixo — o rótulo explica o número,
 * então vem depois dele.
 */
export function Stat({
  label,
  value,
  note,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: "default" | "attention" | "money";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-paper px-4 py-3.5",
        tone === "attention"
          ? "border-coral/30 bg-attention-bg"
          : "border-border",
        className
      )}
    >
      <p
        className={cn(
          "font-display font-extrabold leading-none tracking-[-0.02em] tabular-nums",
          // um valor em texto não compete com um número: fica menor
          typeof value === "string" && !/\d/.test(value)
            ? "text-[17px] text-ink-muted"
            : "text-[26px]",
          tone === "attention" && "text-coral",
          tone === "money" && "text-money",
          tone === "default" && !(typeof value === "string" && !/\d/.test(value)) && "text-ink"
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12.5px] text-ink-muted">{label}</p>
      {note && <p className="mt-0.5 text-[11.5px] text-ink-faint">{note}</p>}
    </div>
  );
}
