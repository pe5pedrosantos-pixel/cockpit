"use client";

import { useId, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createEntry,
  deleteEntry,
  setNfStatus,
  setReceived,
  updateEntry,
} from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { monthLabel } from "@/lib/format";
import { ENTITIES, FINANCE_KINDS, kindLabel, money, NF_STATUS, payerColor } from "@/lib/finance";
import { cn } from "@/lib/utils";

export interface EntryData {
  id: number;
  entity: string;
  payer: string;
  kind: string;
  description: string | null;
  amount: number;
  monthRef: string;
  nfStatus: string;
  nfNumber: string | null;
  nfIssuedAt: string | null;
  received: boolean;
  receivedAt: string | null;
  notes: string | null;
}

// ─── Lista do mês ─────────────────────────────────────────────────────────

export function EntriesTable({
  entries,
  payers,
  nfDue,
}: {
  entries: EntryData[];
  payers: string[];
  /** o mês já começou: NF a emitir pede ação */
  nfDue: boolean;
}) {
  const groups = new Map<string, EntryData[]>();
  for (const e of entries) {
    const list = groups.get(e.payer) ?? [];
    list.push(e);
    groups.set(e.payer, list);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-paper">
      {[...groups.entries()].map(([payer, list], gi) => {
        const subtotal = list.reduce((s, e) => s + e.amount, 0);
        return (
          <div key={payer} className={cn(gi > 0 && "border-t border-border")}>
            <div className="flex items-center justify-between bg-cream/60 px-4 py-2">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: payerColor(payer) }} />
                {payer}
              </div>
              <span className="text-[12.5px] tabular-nums text-ink-muted">{money(subtotal)}</span>
            </div>
            <ul>
              {list.map((e) => (
                <EntryRow key={e.id} entry={e} payers={payers} nfDue={nfDue} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function EntryRow({ entry: e, payers, nfDue }: { entry: EntryData; payers: string[]; nfDue: boolean }) {
  const [pending, start] = useTransition();
  const nfNeedsYou = e.nfStatus === "pendente" && nfDue;
  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-t border-border/70 px-4 py-2.5 first:border-t-0 sm:grid-cols-[1fr_110px_120px_110px_64px]",
        pending && "opacity-60"
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[13.5px] text-ink">{e.description || kindLabel(e.kind)}</p>
        <p className="text-[11.5px] text-ink-faint">
          {kindLabel(e.kind)}
          {e.entity === "pf" ? ", pessoa física" : ""}
          {e.nfNumber ? `, NF ${e.nfNumber}` : ""}
        </p>
      </div>
      <p className="text-right text-[13.5px] font-semibold tabular-nums text-ink sm:order-none">
        {money(e.amount)}
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:contents">
      {/* NF: clique alterna entre emitida e a emitir */}
      {e.nfStatus === "nao_aplica" ? (
        <span className="text-[12px] text-ink-faint">Sem NF</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setNfStatus(e.id, e.nfStatus === "emitida" ? "pendente" : "emitida");
            })
          }
          title={e.nfStatus === "emitida" ? "Voltar para NF a emitir" : "Marcar NF como emitida"}
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-[12px] font-medium transition-colors cursor-pointer",
            e.nfStatus === "emitida"
              ? "bg-navy/10 text-navy hover:bg-navy/15"
              : nfNeedsYou
                ? "bg-attention-bg text-coral hover:bg-coral/15"
                : "bg-black/[0.05] text-ink-muted hover:bg-black/[0.08]"
          )}
        >
          {e.nfStatus === "emitida" && <Check className="h-3 w-3" />}
          {NF_STATUS[e.nfStatus]}
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await setReceived(e.id, !e.received)))}
        title={e.received ? "Desfazer recebimento" : "Marcar como recebido"}
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-[12px] font-medium transition-colors cursor-pointer",
          e.received
            ? "bg-money/10 text-money hover:bg-money/15"
            : "border border-border-strong text-ink-muted hover:bg-cream"
        )}
      >
        {e.received && <Check className="h-3 w-3" />}
        {e.received ? "Recebido" : "A receber"}
      </button>

      </div>

      <div className="flex items-center justify-end gap-0.5">
        <EntryDialog entry={e} payers={payers} />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Apagar "${e.description || kindLabel(e.kind)}" de ${monthLabel(e.monthRef)}?`))
              start(async () => void (await deleteEntry(e.id)));
          }}
          className="rounded p-1.5 text-ink-faint hover:bg-black/[0.05] hover:text-coral cursor-pointer"
          aria-label="Apagar entrada"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ─── Lançar / editar ──────────────────────────────────────────────────────

export function EntryDialog({
  entry,
  payers,
  defaultMonth,
}: {
  entry?: EntryData;
  payers: string[];
  defaultMonth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [payer, setPayer] = useState(entry?.payer ?? payers[0] ?? "__outro");
  const [pending, start] = useTransition();
  const uid = useId();
  const editing = !!entry;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setMsg(null);
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <button
            type="button"
            className="rounded p-1.5 text-ink-faint hover:bg-black/[0.05] hover:text-ink cursor-pointer"
            aria-label="Editar entrada"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> Nova entrada
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={editing ? "Editar entrada" : "Nova entrada"}
        description={editing ? undefined : "Um valor que você espera receber num mês."}
      >
        <form
          action={(fd) =>
            start(async () => {
              const r = editing ? await updateEntry(entry.id, fd) : await createEntry(fd);
              if (r.ok) setOpen(false);
              else setMsg(r.message);
            })
          }
          className="flex flex-col gap-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-payer`}>Quem paga</Label>
              <Select
                id={`${uid}-payer`}
                name="payer"
                value={payer}
                onChange={(ev) => setPayer(ev.target.value)}
              >
                {payers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="__outro">Outro…</option>
              </Select>
            </div>
            {payer === "__outro" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-other`}>Nome de quem paga</Label>
                <Input id={`${uid}-other`} name="payerOther" required autoFocus />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-kind`}>Tipo</Label>
              <Select id={`${uid}-kind`} name="kind" defaultValue={entry?.kind ?? "salario"}>
                {Object.entries(FINANCE_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-amount`}>Valor (R$)</Label>
              <Input
                id={`${uid}-amount`}
                name="amount"
                inputMode="decimal"
                required
                placeholder="7.800,00"
                defaultValue={entry ? entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-month`}>Mês do recebimento</Label>
              <Input
                id={`${uid}-month`}
                name="monthRef"
                type="month"
                required
                defaultValue={entry?.monthRef ?? defaultMonth}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${uid}-desc`}>Descrição (opcional)</Label>
              <Input
                id={`${uid}-desc`}
                name="description"
                placeholder="Ex.: Comissão NORR 1/2"
                defaultValue={entry?.description ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-nf`}>Nota fiscal</Label>
              <Select id={`${uid}-nf`} name="nfStatus" defaultValue={entry?.nfStatus ?? "pendente"}>
                {Object.entries(NF_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-nfn`}>Número da NF (opcional)</Label>
              <Input id={`${uid}-nfn`} name="nfNumber" defaultValue={entry?.nfNumber ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-entity`}>Conta</Label>
              <Select id={`${uid}-entity`} name="entity" defaultValue={entry?.entity ?? "pj"}>
                {Object.entries(ENTITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            {!editing && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-rep`}>Repetir por</Label>
                <Select id={`${uid}-rep`} name="repeat" defaultValue="1">
                  <option value="1">Só este mês</option>
                  {[2, 3, 4, 5, 6, 9, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} meses
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-notes`}>Observações (opcional)</Label>
            <Textarea id={`${uid}-notes`} name="notes" rows={2} defaultValue={entry?.notes ?? ""} />
          </div>
          {msg && <p className="text-[12.5px] text-coral">{msg}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : editing ? "Salvar" : "Lançar entrada"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
