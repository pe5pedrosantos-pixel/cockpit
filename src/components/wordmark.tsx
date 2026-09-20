import { cn } from "@/lib/utils";

/**
 * Wordmark da marca, recriado em texto (Montserrat 800, o mesmo da logo)
 * para escalar e recolorir conforme o fundo — em vez de uma imagem fixa.
 */
export function Wordmark({
  tone = "light",
  size = "md",
  tagline,
  className,
}: {
  /** "light" = sobre navy · "dark" = sobre off-white */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  tagline?: string;
  className?: string;
}) {
  const scale = {
    sm: { line: "text-[15px] leading-[0.94]", tag: "text-[7px]" },
    md: { line: "text-[19px] leading-[0.92]", tag: "text-[8px]" },
    lg: { line: "text-[40px] leading-[0.9]", tag: "text-[11px]" },
  }[size];

  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span
        className={cn(
          "font-display font-extrabold tracking-[-0.02em]",
          scale.line,
          tone === "light" ? "text-on-navy" : "text-navy"
        )}
      >
        <span className="block">PE5</span>
        <span className="block">
          COCKPIT<span className="text-coral">.</span>
        </span>
      </span>
      {tagline && (
        <span
          className={cn(
            "mt-2 flex items-center gap-1.5 font-display font-semibold uppercase tracking-[0.18em]",
            scale.tag,
            tone === "light" ? "text-on-navy-muted" : "text-ink-muted"
          )}
        >
          <span className="h-[2px] w-4 bg-coral" />
          {tagline}
        </span>
      )}
    </span>
  );
}
