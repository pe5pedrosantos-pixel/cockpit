import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/**
 * Lista do que precisa de atenção. O coral marca o que está atrasado;
 * o resto fica em tinta comum. Sem ícone de estado: a frase já diz.
 */
export function AlertsPanel({
  alerts,
  emptyMessage = "Nada atrasado por aqui.",
}: {
  alerts: Alert[];
  emptyMessage?: string;
}) {
  if (alerts.length === 0) {
    return <p className="text-[13.5px] text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((a, i) => (
        <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug">
          <span
            className={cn(
              "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
              a.level === "critical" ? "bg-coral" : "bg-ink-faint"
            )}
          />
          <span className={a.level === "critical" ? "text-ink" : "text-ink-muted"}>
            {a.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
