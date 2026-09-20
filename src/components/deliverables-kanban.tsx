"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import {
  deleteDeliverable,
  incrementDelivered,
  setDeliverableStatus,
} from "@/lib/actions/deliverables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DeliverableFormDialog,
  type DeliverableFormData,
} from "@/components/deliverable-form";
import { dateShort, monthLabel, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DeliverableCardData extends DeliverableFormData {
  id: number;
  companyId: number;
  title: string;
  monthRef: string;
  plannedQty: number;
  deliveredQty: number;
  status: string;
  effectiveStatus: string;
  companyName: string;
  companyColor: string;
  categoryName?: string | null;
}

type ColKey = "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO";

const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "PLANEJADO", label: "A fazer" },
  { key: "EM_ANDAMENTO", label: "Em produção" },
  { key: "CONCLUIDO", label: "Entregues" },
];

function columnOf(item: DeliverableCardData): ColKey {
  if (item.status === "CONCLUIDO") return "CONCLUIDO";
  if (item.status === "PLANEJADO") return "PLANEJADO";
  return "EM_ANDAMENTO"; // EM_ANDAMENTO e ATRASADO
}

export function DeliverablesKanban({
  items,
  companies,
  categories,
  defaultMonth,
  showCompany = true,
}: {
  items: DeliverableCardData[];
  companies: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  defaultMonth: string;
  showCompany?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<ColKey | null>(null);

  const grouped = useMemo(() => {
    const g: Record<ColKey, DeliverableCardData[]> = {
      PLANEJADO: [],
      EM_ANDAMENTO: [],
      CONCLUIDO: [],
    };
    for (const item of items) g[columnOf(item)].push(item);
    return g;
  }, [items]);

  function move(id: number, col: ColKey) {
    startTransition(() => setDeliverableStatus(id, col));
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = grouped[col.key];
        const qty = list.reduce(
          (s, d) =>
            s +
            (col.key === "CONCLUIDO"
              ? d.deliveredQty
              : Math.max(d.plannedQty - d.deliveredQty, 0)),
          0
        );
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.key);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id) move(id, col.key);
            }}
            className={cn(
              "flex min-h-[180px] flex-col gap-2.5 rounded-xl border border-border bg-black/[0.025] p-3 transition-colors",
              dragOver === col.key && "border-coral bg-attention-bg"
            )}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[12.5px] font-semibold text-ink">
                {col.label}
              </span>
              <Badge tone="outline">
                {list.length} {list.length === 1 ? "item" : "itens"} · {qty} un.
              </Badge>
            </div>

            {list.map((item) => {
              const percent = pct(item.deliveredQty, item.plannedQty);
              const late = item.effectiveStatus === "ATRASADO";
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(item.id))
                  }
                  className={cn(
                    "group cursor-grab rounded-lg border border-border bg-paper p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
                    late && "border-coral/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                        {showCompany && (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: item.companyColor }}
                            />
                            {item.companyName}
                          </span>
                        )}
                        <span>{monthLabel(item.monthRef)}</span>
                        {item.deadline && (
                          <span className={cn(late && "font-medium text-coral")}>
                            até {dateShort(item.deadline)}
                          </span>
                        )}
                        {item.categoryName && <span>· {item.categoryName}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <DeliverableFormDialog
                        companies={companies}
                        categories={categories}
                        initial={item}
                        defaultMonth={defaultMonth}
                        trigger="icon"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        onClick={() => {
                          if (confirm(`Excluir "${item.title}"?`))
                            startTransition(() => deleteDeliverable(item.id));
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-coral" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <Progress value={percent} className="h-1.5 flex-1" />
                    <span className="text-[11px] font-semibold tabular-nums">
                      {percent}%
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-ink-muted tabular-nums">
                      <strong className="text-ink">
                        {item.deliveredQty}
                      </strong>
                      /{item.plannedQty} entregues
                      {item.plannedQty - item.deliveredQty > 0 && (
                        <> · faltam {item.plannedQty - item.deliveredQty}</>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {late && <Badge tone="danger">Atrasado</Badge>}
                      <Button
                        variant="subtle"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isPending || item.deliveredQty <= 0}
                        onClick={() =>
                          startTransition(() => incrementDelivered(item.id, -1))
                        }
                        aria-label="-1 entregue"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="subtle"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isPending || item.deliveredQty >= item.plannedQty}
                        onClick={() =>
                          startTransition(() => incrementDelivered(item.id, 1))
                        }
                        aria-label="+1 entregue"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {list.length === 0 && (
              <p className="px-1 py-4 text-center text-xs text-ink-muted">
                Nenhuma entrega aqui.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
