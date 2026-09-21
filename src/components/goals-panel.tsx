"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteGoal, saveGoal } from "@/lib/actions/items";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { dateShort } from "@/lib/format";
import { FORMATS, PLATFORMS, formatLabel, platformLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export interface GoalRow {
  id: number;
  title: string;
  platform: string;
  format: string | null;
  targetQty: number;
  period: "week" | "month";
  done: number;
  remaining: number;
  percent: number;
  daysLeft: number;
  behind: boolean;
  periodStart: string;
  periodEnd: string;
  previousDone: number;
}

/** Metas recorrentes com o progresso do período corrente. */
export function GoalsPanel({
  goals,
  companyId,
  color,
}: {
  goals: GoalRow[];
  companyId: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Metas</h2>
        <GoalFormDialog companyId={companyId} />
      </div>

      {goals.length === 0 ? (
        <p className="text-[13.5px] text-ink-muted">
          Nenhuma meta recorrente. Crie uma para acompanhar ritmo por semana ou por mês.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} color={color} companyId={companyId} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  color,
  companyId,
}: {
  goal: GoalRow;
  color: string;
  companyId: number;
}) {
  const [isPending, startTransition] = useTransition();
  const periodWord = goal.period === "week" ? "esta semana" : "este mês";
  const met = goal.remaining === 0;

  return (
    <div
      className={cn(
        "group rounded-lg border bg-paper px-4 py-3.5",
        goal.behind ? "border-coral/30 bg-attention-bg" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium">{goal.title}</p>
          <p className="text-[11.5px] text-ink-muted">
            {goal.targetQty} por {goal.period === "week" ? "semana" : "mês"} no{" "}
            {platformLabel(goal.platform)}
            {goal.format ? `, só ${formatLabel(goal.format)?.toLowerCase()}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <GoalFormDialog companyId={companyId} initial={goal} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Remover meta"
            disabled={isPending}
            onClick={() => {
              if (confirm(`Remover a meta "${goal.title}"?`))
                startTransition(() => deleteGoal(goal.id));
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p
        className={cn(
          "mt-3 font-display text-[24px] font-extrabold leading-none tracking-[-0.02em] tabular-nums",
          goal.behind ? "text-coral" : met ? "text-money" : "text-ink"
        )}
      >
        {goal.done}
        <span className="text-[15px] font-semibold text-ink-faint"> de {goal.targetQty}</span>
      </p>
      <Progress
        value={goal.percent}
        color={goal.behind ? "var(--coral)" : met ? "var(--money)" : color}
        className="mt-2.5"
        label={`${goal.title}: ${goal.done} de ${goal.targetQty} ${periodWord}`}
      />
      <p className="mt-1.5 text-[11.5px] text-ink-muted">
        {met
          ? `Meta batida ${periodWord}.`
          : goal.behind
            ? `Atrás do ritmo: faltam ${goal.remaining} em ${goal.daysLeft} ${goal.daysLeft === 1 ? "dia" : "dias"}.`
            : `Faltam ${goal.remaining} ${periodWord}, até ${dateShort(goal.periodEnd)}.`}
      </p>
      <p className="mt-0.5 text-[11.5px] text-ink-faint">
        {goal.period === "week" ? "Semana passada" : "Mês passado"}: {goal.previousDone} de{" "}
        {goal.targetQty}
      </p>
    </div>
  );
}

function GoalFormDialog({
  companyId,
  initial,
}: {
  companyId: number;
  initial?: GoalRow;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar meta">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" /> Nova meta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={initial ? "Editar meta" : "Nova meta"}>
        <form
          action={(fd) => {
            fd.set("companyId", String(companyId));
            startTransition(async () => {
              await saveGoal(fd, initial?.id);
              setOpen(false);
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-title">Nome</Label>
            <Input
              id="g-title"
              name="title"
              required
              placeholder="Ex.: Posts no Instagram"
              defaultValue={initial?.title ?? ""}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-qty">Quantidade</Label>
              <Input
                id="g-qty"
                name="targetQty"
                type="number"
                min={1}
                required
                defaultValue={initial?.targetQty ?? 4}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="g-period">Por</Label>
              <Select id="g-period" name="period" defaultValue={initial?.period ?? "week"}>
                <option value="week">semana (segunda a domingo)</option>
                <option value="month">mês</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-platform">Rede</Label>
              <Select id="g-platform" name="platform" defaultValue={initial?.platform ?? "instagram"}>
                {Object.entries(PLATFORMS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-format">Contar só o formato</Label>
              <Select id="g-format" name="format" defaultValue={initial?.format ?? ""}>
                <option value="">Qualquer formato</option>
                {Object.entries(FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[12px] text-ink-muted">
            A meta se repete sozinha e avança conforme você registra os links
            das publicações.
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar meta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
