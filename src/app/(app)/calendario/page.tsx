import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { deliverables, tasks } from "@/lib/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { currentMonthRef, daysInMonth, monthLabel, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function shiftMonth(monthRef: string, delta: number) {
  const [y, m] = monthRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const monthRef = mes ?? currentMonthRef();
  const [year, month] = monthRef.split("-").map(Number);
  const today = todayISO();

  const monthTasks = await db.query.tasks.findMany({
    where: isNotNull(tasks.dueDate),
    with: { company: true },
  });
  const monthDeliverables = await db.query.deliverables.findMany({
    where: and(isNotNull(deliverables.deadline), eq(deliverables.monthRef, monthRef)),
    with: { company: true },
  });

  type Event = { label: string; color: string; kind: "tarefa" | "entrega"; done: boolean };
  const events = new Map<string, Event[]>();
  const push = (date: string, e: Event) => {
    if (!date.startsWith(monthRef)) return;
    const list = events.get(date) ?? [];
    list.push(e);
    events.set(date, list);
  };
  for (const t of monthTasks) {
    if (t.dueDate)
      push(t.dueDate, {
        label: t.title,
        color: t.company?.color ?? "#71717a",
        kind: "tarefa",
        done: t.status === "CONCLUIDA",
      });
  }
  for (const d of monthDeliverables) {
    if (d.deadline)
      push(d.deadline, {
        label: `${d.title} (${d.deliveredQty}/${d.plannedQty})`,
        color: d.company.color,
        kind: "entrega",
        done: d.status === "CONCLUIDO",
      });
  }

  // dentro do dia: horários marcados em ordem ("12h", "13h30"), depois o
  // que não tem hora, e "fim do dia" por último
  const timeKey = (label: string) => {
    const m = label.match(/^\s*(\d{1,2})h(\d{2})?/i);
    if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
    if (/^\s*fim do dia/i.test(label)) return 24 * 60 + 1;
    return 24 * 60;
  };
  for (const list of events.values()) {
    list.sort((a, b) => timeKey(a.label) - timeKey(b.label));
  }

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const totalDays = daysInMonth(monthRef);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.025em]">Calendário</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Tarefas e prazos de entrega no mês
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendario?mes=${shiftMonth(monthRef, -1)}`}
            className="rounded-lg border border-border bg-paper p-2 hover:bg-black/[0.04]"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-semibold">
            {monthLabel(monthRef)}
          </span>
          <Link
            href={`/calendario?mes=${shiftMonth(monthRef, 1)}`}
            className="rounded-lg border border-border bg-paper p-2 hover:bg-black/[0.04]"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center text-[11px] font-medium text-ink-faint"
              >
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              const dateISO =
                day !== null
                  ? `${monthRef}-${String(day).padStart(2, "0")}`
                  : null;
              const dayEvents = dateISO ? events.get(dateISO) ?? [] : [];
              const isToday = dateISO === today;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-20 rounded-lg border border-transparent p-1.5 md:min-h-24",
                    day !== null && "border-border/60 bg-paper",
                    isToday && "border-coral bg-attention-bg"
                  )}
                >
                  {day !== null && (
                    <>
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          isToday
                            ? "flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[11px] text-white"
                            : "text-ink-muted"
                        )}
                      >
                        {day}
                      </span>
                      <div className="mt-1 flex flex-col gap-0.5">
                        {dayEvents.slice(0, 5).map((e, j) => (
                          <div
                            key={j}
                            title={`${e.kind === "entrega" ? "Entrega" : "Tarefa"}: ${e.label}`}
                            className={cn(
                              "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-white",
                              e.done && "opacity-50 line-through"
                            )}
                            style={{ backgroundColor: e.color }}
                          >
                            {e.label}
                          </div>
                        ))}
                        {dayEvents.length > 5 && (
                          <span className="px-1 text-[10px] text-ink-muted">
                            +{dayEvents.length - 5}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
