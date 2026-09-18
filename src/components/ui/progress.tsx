import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  color,
}: {
  value: number; // 0–100
  className?: string;
  color?: string;
}) {
  const v = Math.min(Math.max(value, 0), 100);
  const barColor =
    color ?? (v >= 100 ? "#16a34a" : v >= 60 ? "#4f46e5" : v >= 30 ? "#d97706" : "#dc2626");
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-100", className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${v}%`, backgroundColor: barColor }}
      />
    </div>
  );
}
