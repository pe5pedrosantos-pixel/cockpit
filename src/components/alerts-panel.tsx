import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

const config = {
  critical: {
    icon: OctagonAlert,
    box: "border-red-200 bg-red-50/70",
    icn: "text-red-600",
  },
  warning: {
    icon: AlertTriangle,
    box: "border-amber-200 bg-amber-50/70",
    icn: "text-amber-600",
  },
  ok: {
    icon: CheckCircle2,
    box: "border-green-200 bg-green-50/70",
    icn: "text-green-600",
  },
} as const;

export function AlertsPanel({
  alerts,
  emptyMessage = "Tudo em dia. Nenhum alerta no momento.",
}: {
  alerts: Alert[];
  emptyMessage?: string;
}) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/70 px-3 py-2.5 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a, i) => {
        const c = config[a.level];
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
              c.box
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", c.icn)} />
            <span>{a.message}</span>
          </div>
        );
      })}
    </div>
  );
}
