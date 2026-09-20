import { cn } from "@/lib/utils";

/**
 * Barra de progresso: magnitude em uma cor só.
 * Quando a empresa tem cor própria, ela é usada como identidade; senão,
 * navy. O coral fica reservado para o que precisa de atenção.
 */
export function Progress({
  value,
  className,
  color,
  label,
}: {
  value: number;
  className?: string;
  color?: string;
  label?: string;
}) {
  const v = Math.min(Math.max(value, 0), 100);
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-black/[0.07]", className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${v}%`, backgroundColor: color ?? "var(--navy)" }}
      />
    </div>
  );
}
