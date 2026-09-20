"use client";

import { useMemo, useState, useTransition } from "react";
import { setTaskStatus } from "@/lib/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { TaskItem, type TaskItemData } from "@/components/task-item";
import { cn } from "@/lib/utils";

type ColKey = "A_FAZER" | "EM_ANDAMENTO" | "CONCLUIDA";

const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "A_FAZER", label: "A fazer" },
  { key: "EM_ANDAMENTO", label: "Em andamento" },
  { key: "CONCLUIDA", label: "Concluídas" },
];

export function TasksKanban({
  tasks,
  companies,
}: {
  tasks: TaskItemData[];
  companies: { id: number; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<ColKey | null>(null);

  const grouped = useMemo(() => {
    const g: Record<ColKey, TaskItemData[]> = {
      A_FAZER: [],
      EM_ANDAMENTO: [],
      CONCLUIDA: [],
    };
    for (const t of tasks) g[(t.status as ColKey) ?? "A_FAZER"].push(t);
    return g;
  }, [tasks]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => (
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
            if (id) startTransition(() => setTaskStatus(id, col.key));
          }}
          className={cn(
            "flex min-h-[160px] flex-col gap-2 rounded-xl border border-border bg-black/[0.025] p-3 transition-colors",
            dragOver === col.key && "border-coral bg-attention-bg"
          )}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[12.5px] font-semibold text-ink">
              {col.label}
            </span>
            <Badge tone="outline">{grouped[col.key].length}</Badge>
          </div>
          {grouped[col.key].map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", String(t.id))
              }
              className="cursor-grab active:cursor-grabbing"
            >
              <TaskItem task={t} companies={companies} />
            </div>
          ))}
          {grouped[col.key].length === 0 && (
            <p className="px-1 py-4 text-center text-xs text-ink-muted">
              Nenhuma tarefa.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
