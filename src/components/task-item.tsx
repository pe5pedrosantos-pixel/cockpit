"use client";

import { useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { deleteTask, toggleTask } from "@/lib/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskFormDialog, type TaskFormData } from "@/components/task-form";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/components/status-maps";
import { dateShort, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TaskItemData extends TaskFormData {
  id: number;
  title: string;
  priority: string;
  status: string;
  companyName?: string | null;
  companyColor?: string | null;
}

export function TaskItem({
  task,
  companies,
}: {
  task: TaskItemData;
  companies: { id: number; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const done = task.status === "CONCLUIDA";
  const overdue = !done && task.dueDate && task.dueDate < todayISO();

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-paper px-3 py-2.5 transition-colors hover:bg-black/[0.025]",
        done && "opacity-60"
      )}
    >
      <button
        disabled={isPending}
        onClick={() => startTransition(() => toggleTask(task.id, !done))}
        aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer",
          done
            ? "border-money bg-money text-white"
            : "border-border-strong bg-paper hover:border-coral"
        )}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", done && "line-through")}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            {task.companyColor && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: task.companyColor }}
              />
            )}
            {task.companyName ?? "Pessoal"}
          </span>
          {task.dueDate && (
            <span className={cn(overdue && "font-semibold text-coral")}>
              {overdue ? "atrasada, " : ""}
              {dateShort(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      <Badge tone={PRIORITY_TONE[task.priority] ?? "default"}>
        {PRIORITY_LABEL[task.priority] ?? task.priority}
      </Badge>

      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <TaskFormDialog companies={companies} initial={task} trigger="icon" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Excluir tarefa"
          onClick={() => {
            if (confirm(`Excluir "${task.title}"?`))
              startTransition(() => deleteTask(task.id));
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-coral" />
        </Button>
      </div>
    </div>
  );
}
