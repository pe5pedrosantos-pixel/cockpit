"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarPlus, Check, NotebookPen } from "lucide-react";
import {
  addNoteAction,
  createActivityAction,
  getActivityTypesAction,
  setActivityDoneAction,
} from "@/lib/actions/pipedrive";
import { activityWhen, type ActivityRowData } from "@/lib/activities";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_FALLBACK: Record<string, string> = {
  call: "Ligação",
  meeting: "Reunião",
  task: "Tarefa",
  deadline: "Prazo",
  email: "E-mail",
  lunch: "Almoço",
  whatsapp: "WhatsApp",
};

/** Tipos de atividade da conta, carregados uma vez por sessão do navegador. */
let typesCache: { key: string; name: string }[] | null = null;
function useActivityTypes(enabled: boolean) {
  const [types, setTypes] = useState(typesCache);
  useEffect(() => {
    if (!enabled || typesCache) return;
    getActivityTypesAction()
      .then((t) => {
        typesCache = t.length > 0 ? t : null;
        setTypes(
          typesCache ?? Object.entries(TYPE_FALLBACK).map(([key, name]) => ({ key, name }))
        );
      })
      .catch(() =>
        setTypes(Object.entries(TYPE_FALLBACK).map(([key, name]) => ({ key, name })))
      );
  }, [enabled]);
  return types;
}

export function typeName(key: string | null): string | null {
  if (!key) return null;
  return (
    typesCache?.find((t) => t.key === key)?.name ??
    TYPE_FALLBACK[key] ??
    key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ")
  );
}

// ─── Lista com "concluir" ─────────────────────────────────────────────────

export function CrmActivityList({
  activities,
  showDeal = true,
  onChanged,
}: {
  activities: ActivityRowData[];
  showDeal?: boolean;
  onChanged?: () => void;
}) {
  if (activities.length === 0) {
    return <p className="text-[13px] text-ink-muted">Nenhuma atividade.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {activities.map((a) => (
        <CrmActivityRow key={a.id} activity={a} showDeal={showDeal} onChanged={onChanged} />
      ))}
    </div>
  );
}

function CrmActivityRow({
  activity: a,
  showDeal,
  onChanged,
}: {
  activity: ActivityRowData;
  showDeal: boolean;
  onChanged?: () => void;
}) {
  const [done, setDone] = useState(a.done);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const today = todayISO();

  const toggle = () => {
    const next = !done;
    setDone(next);
    setError(null);
    startTransition(async () => {
      const res = await setActivityDoneAction(a.id, next);
      if (!res.ok) {
        setDone(!next);
        setError(res.message);
      } else {
        onChanged?.();
      }
    });
  };

  const context = showDeal ? (a.dealTitle ?? a.orgName) : null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-paper px-3 py-2.5",
        done && "opacity-60"
      )}
    >
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        aria-label={done ? "Reabrir atividade" : "Concluir atividade"}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors",
          done
            ? "border-money bg-money text-white"
            : "border-border-strong bg-paper hover:border-coral"
        )}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "line-through")}>{a.subject}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-ink-muted">
          {a.day && (
            <span className={cn(a.overdue && !done && "font-semibold text-coral")}>
              {activityWhen(a.day, a.time, today)}
            </span>
          )}
          {a.type && <span>{typeName(a.type)}</span>}
          {context && <span className="truncate">{context}</span>}
        </p>
        {a.note && (
          <p className="mt-1 line-clamp-2 text-[12px] text-ink-muted">
            {a.note.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim()}
          </p>
        )}
        {error && <p className="mt-1 text-[12px] text-coral">{error}</p>}
      </div>
    </div>
  );
}

// ─── Formulários ──────────────────────────────────────────────────────────

interface Target {
  dealPipedriveId?: number | null;
  orgPipedriveId?: number | null;
  label: string;
}

export function ActivityFormDialog({
  target,
  onDone,
  trigger,
}: {
  target: Target;
  onDone?: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const types = useActivityTypes(open);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setMessage(null);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <CalendarPlus className="h-3.5 w-3.5" /> Nova atividade
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="Nova atividade" description={`Vai direto para o Pipedrive, em ${target.label}.`}>
        <form
          action={(fd) => {
            if (target.dealPipedriveId) fd.set("dealPipedriveId", String(target.dealPipedriveId));
            if (target.orgPipedriveId) fd.set("orgPipedriveId", String(target.orgPipedriveId));
            setMessage(null);
            startTransition(async () => {
              const res = await createActivityAction(fd);
              setMessage({ ok: res.ok, text: res.message });
              if (res.ok) {
                onDone?.();
                setTimeout(() => setOpen(false), 700);
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-type">Tipo</Label>
              <Select id="act-type" name="type" defaultValue="call">
                {(types ?? Object.entries(TYPE_FALLBACK).map(([key, name]) => ({ key, name }))).map(
                  (t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  )
                )}
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="act-subject">Assunto</Label>
              <Input id="act-subject" name="subject" required placeholder="Ex.: Ligar para alinhar proposta" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-date">Data</Label>
              <Input id="act-date" name="dueDate" type="date" required defaultValue={todayISO()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-time">Horário (opcional)</Label>
              <Input id="act-time" name="dueTime" type="time" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="act-note">Observação (opcional)</Label>
            <Textarea id="act-note" name="note" rows={3} />
          </div>
          {message && (
            <p className={cn("text-[13px]", message.ok ? "text-money" : "text-coral")}>{message.text}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Criando no Pipedrive…" : "Criar atividade"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NoteFormDialog({ target, trigger }: { target: Target; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setMessage(null);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <NotebookPen className="h-3.5 w-3.5" /> Registrar nota
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="Registrar nota" description={`Fica no histórico de ${target.label} no Pipedrive.`}>
        <form
          action={(fd) => {
            if (target.dealPipedriveId) fd.set("dealPipedriveId", String(target.dealPipedriveId));
            if (target.orgPipedriveId) fd.set("orgPipedriveId", String(target.orgPipedriveId));
            setMessage(null);
            startTransition(async () => {
              const res = await addNoteAction(fd);
              setMessage({ ok: res.ok, text: res.message });
              if (res.ok) setTimeout(() => setOpen(false), 700);
            });
          }}
          className="flex flex-col gap-4"
        >
          <Textarea name="content" rows={6} required placeholder="O que foi conversado, próximos passos…" autoFocus />
          {message && (
            <p className={cn("text-[13px]", message.ok ? "text-money" : "text-coral")}>{message.text}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando no Pipedrive…" : "Salvar nota"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
