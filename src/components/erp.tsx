"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import {
  copyOutflows,
  createEntry,
  deleteEntry,
  setNfStatus,
  setReceived,
  updateAmount,
  updateEntry,
} from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { monthLabel } from "@/lib/format";
import {
  addMonths,
  type Direction,
  ENTITIES,
  FINANCE_KINDS,
  kindLabel,
  money,
  type MonthBalance,
  monthShort,
  NF_STATUS,
  OUT_KINDS,
  parseMoney,
  payerColor,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

export interface EntryData {
  id: number;
  direction: Direction;
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

// ─── Valor editável no lugar ──────────────────────────────────────────────

/** Clique no valor para trocar (fatura do cartão, conta que veio diferente). */
function AmountCell({ entry }: { entry: EntryData }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  const save = () => {
    const n = parseMoney(value);
    setEditing(false);
    if (n === null || n <= 0 || n === entry.amount) return;
    start(async () => void (await updateAmount(entry.id, value)));
  };

  if (editing)
    return (
      <Input
        autoFocus
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-8 w-28 text-right tabular-nums"
        aria-label="Novo valor"
      />
    );

  return (
    <button
      type="button"
      onClick={() => {
        setValue(entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
        setEditing(true);
      }}
      title="Clique para alterar o valor"
      className={cn(
        "rounded px-1.5 py-0.5 text-right text-[13.5px] font-semibold tabular-nums text-ink decoration-dotted underline-offset-4 hover:bg-black/[0.04] hover:underline cursor-text",
        pending && "opacity-50"
      )}
    >
      {money(entry.amount)}
    </button>
  );
}

function DeleteButton({ entry }: { entry: EntryData }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const label = entry.direction === "saida" ? entry.payer : entry.description || kindLabel(entry.kind);
        if (window.confirm(`Apagar "${label}" de ${monthLabel(entry.monthRef)}?`))
          start(async () => void (await deleteEntry(entry.id)));
      }}
      className="rounded p-1.5 text-ink-faint hover:bg-black/[0.05] hover:text-coral cursor-pointer"
      aria-label="Apagar lançamento"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function PaidToggle({ entry }: { entry: EntryData }) {
  const [pending, start] = useTransition();
  const out = entry.direction === "saida";
  const on = entry.received;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setReceived(entry.id, !on)))}
      title={on ? "Desfazer" : out ? "Marcar como paga" : "Marcar como recebido"}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-[12px] font-medium transition-colors cursor-pointer",
        pending && "opacity-60",
        on
          ? out
            ? "bg-navy/10 text-navy hover:bg-navy/15"
            : "bg-money/10 text-money hover:bg-money/15"
          : "border border-border-strong text-ink-muted hover:bg-cream"
      )}
    >
      {on && <Check className="h-3 w-3" />}
      {out ? (on ? "Paga" : "A pagar") : on ? "Recebido" : "A receber"}
    </button>
  );
}

// ─── Entradas do mês ──────────────────────────────────────────────────────

export function EntriesTable({
  entries,
  names,
  nfDue,
}: {
  entries: EntryData[];
  names: string[];
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
      {[...groups.entries()].map(([payer, list], gi) => (
        <div key={payer} className={cn(gi > 0 && "border-t border-border")}>
          <GroupHeader
            label={payer}
            dot={payerColor(payer)}
            total={list.reduce((s, e) => s + e.amount, 0)}
          />
          <ul>
            {list.map((e) => (
              <IncomeRow key={e.id} entry={e} names={names} nfDue={nfDue} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GroupHeader({ label, dot, total, note }: { label: string; dot?: string; total: number; note?: string }) {
  return (
    <div className="flex items-center justify-between bg-cream/60 px-4 py-2">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        {dot && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
        {note && <span className="text-[11.5px] font-normal text-ink-faint">{note}</span>}
      </div>
      <span className="text-[12.5px] tabular-nums text-ink-muted">{money(total)}</span>
    </div>
  );
}

const rowGrid =
  "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-t border-border/70 px-4 py-2.5 first:border-t-0 sm:grid-cols-[1fr_120px_120px_110px_64px]";

function IncomeRow({ entry: e, names, nfDue }: { entry: EntryData; names: string[]; nfDue: boolean }) {
  const [pending, start] = useTransition();
  const nfNeedsYou = e.nfStatus === "pendente" && nfDue;
  return (
    <li className={cn(rowGrid, pending && "opacity-60")}>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] text-ink">{e.description || kindLabel(e.kind)}</p>
        <p className="text-[11.5px] text-ink-faint">
          {kindLabel(e.kind)}
          {e.entity === "pf" ? ", pessoa física" : ""}
          {e.nfNumber ? `, NF ${e.nfNumber}` : ""}
        </p>
      </div>
      <div className="flex justify-end">
        <AmountCell entry={e} />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:contents">
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
        <PaidToggle entry={e} />
      </div>

      <div className="flex items-center justify-end gap-0.5">
        <EntryDialog direction="entrada" entry={e} names={names} />
        <DeleteButton entry={e} />
      </div>
    </li>
  );
}

// ─── Saídas do mês ────────────────────────────────────────────────────────

export function OutflowsTable({ entries, names }: { entries: EntryData[]; names: string[] }) {
  const groups: { key: string; label: string; note: string; list: EntryData[] }[] = [
    {
      key: "pj",
      label: "Pessoa jurídica",
      note: "pago pela conta PJ",
      list: entries.filter((e) => e.entity === "pj"),
    },
    {
      key: "pf",
      label: "Pessoa física",
      note: "pago pela conta PF",
      list: entries.filter((e) => e.entity !== "pj"),
    },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-paper">
      {groups.map((g, gi) => (
        <div key={g.key} className={cn(gi > 0 && "border-t border-border")}>
          <GroupHeader label={g.label} note={g.note} total={g.list.reduce((s, e) => s + e.amount, 0)} />
          <ul>
            {g.list.map((e) => (
              <li key={e.id} className={rowGrid}>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-ink">{e.payer}</p>
                  <p className="text-[11.5px] text-ink-faint">
                    {kindLabel(e.kind)}
                    {e.description ? `, ${e.description}` : ""}
                  </p>
                </div>
                <div className="flex justify-end">
                  <AmountCell entry={e} />
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:contents">
                  <span className="hidden sm:block" />
                  <PaidToggle entry={e} />
                </div>
                <div className="flex items-center justify-end gap-0.5">
                  <EntryDialog direction="saida" entry={e} names={names} />
                  <DeleteButton entry={e} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function CopyOutflowsButton({ from, to }: { from: string; to: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await copyOutflows(from, to);
            setMsg(r.message);
          })
        }
      >
        <Copy className="h-3.5 w-3.5" />
        {pending ? "Copiando…" : `Copiar contas de ${monthShort(from)}`}
      </Button>
      {msg && <span className="text-[12px] text-ink-muted">{msg}</span>}
    </span>
  );
}

// ─── Lançar / editar ──────────────────────────────────────────────────────

export function EntryDialog({
  direction,
  entry,
  names,
  defaultMonth,
}: {
  direction: Direction;
  entry?: EntryData;
  names: string[];
  defaultMonth?: string;
}) {
  const out = direction === "saida";
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState(entry?.payer ?? names[0] ?? "__outro");
  const [pending, start] = useTransition();
  const uid = useId();
  const editing = !!entry;
  const kinds = out ? OUT_KINDS : FINANCE_KINDS;
  const noun = out ? "saída" : "entrada";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setMsg(null);
        if (v) setName(entry?.payer ?? names[0] ?? "__outro");
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <button
            type="button"
            className="rounded p-1.5 text-ink-faint hover:bg-black/[0.05] hover:text-ink cursor-pointer"
            aria-label={`Editar ${noun}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button size="sm" variant={out ? "outline" : "default"}>
            <Plus className="h-3.5 w-3.5" /> Nova {noun}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={editing ? `Editar ${noun}` : `Nova ${noun}`}
        description={
          editing
            ? undefined
            : out
              ? "Uma conta fixa do mês. Cartões: lance o valor da fatura e ajuste quando fechar."
              : "Um valor que você espera receber num mês."
        }
      >
        <form
          action={(fd) =>
            start(async () => {
              fd.set("direction", direction);
              const r = editing ? await updateEntry(entry.id, fd) : await createEntry(fd);
              if (r.ok) setOpen(false);
              else setMsg(r.message);
            })
          }
          className="flex flex-col gap-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-name`}>{out ? "Conta" : "Quem paga"}</Label>
              <Select id={`${uid}-name`} name="payer" value={name} onChange={(ev) => setName(ev.target.value)}>
                {names.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="__outro">{out ? "Nova conta…" : "Outro…"}</option>
              </Select>
            </div>
            {name === "__outro" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-other`}>{out ? "Nome da conta" : "Nome de quem paga"}</Label>
                <Input
                  id={`${uid}-other`}
                  name="payerOther"
                  required
                  autoFocus
                  placeholder={out ? "Ex.: Academia" : ""}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-entity`}>{out ? "Sai de qual conta" : "Conta"}</Label>
              <Select id={`${uid}-entity`} name="entity" defaultValue={entry?.entity ?? (out ? "pf" : "pj")}>
                {Object.entries(ENTITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-kind`}>Tipo</Label>
              <Select id={`${uid}-kind`} name="kind" defaultValue={entry?.kind ?? (out ? "fixo" : "salario")}>
                {Object.entries(kinds).map(([k, v]) => (
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
                placeholder={out ? "3.200,00" : "7.800,00"}
                defaultValue={entry ? entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-month`}>{out ? "Mês" : "Mês do recebimento"}</Label>
              <Input
                id={`${uid}-month`}
                name="monthRef"
                type="month"
                required
                defaultValue={entry?.monthRef ?? defaultMonth}
              />
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
            <div className={cn("flex flex-col gap-1.5", out && editing && "sm:col-span-2")}>
              <Label htmlFor={`${uid}-desc`}>{out ? "Detalhe (opcional)" : "Descrição (opcional)"}</Label>
              <Input
                id={`${uid}-desc`}
                name="description"
                placeholder={out ? "Ex.: parcela 4 de 12" : "Ex.: Comissão NORR 1/2"}
                defaultValue={entry?.description ?? ""}
              />
            </div>
            {!out && (
              <>
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
              </>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-notes`}>Observações (opcional)</Label>
            <Textarea id={`${uid}-notes`} name="notes" rows={2} defaultValue={entry?.notes ?? ""} />
          </div>
          {msg && <p className="text-[12.5px] text-coral">{msg}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : editing ? "Salvar" : `Lançar ${noun}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Calculadora de sobra ─────────────────────────────────────────────────

/**
 * Sobra mês a mês (entradas menos saídas PJ e PF), com um simulador:
 * "e se eu assumir uma parcela de R$ 800 por 10 meses?".
 */
export function BalanceCalculator({ balances, selected }: { balances: MonthBalance[]; selected: string }) {
  const months = balances.map((b) => b.monthRef);
  const [start, setStart] = useState("");
  const [simKind, setSimKind] = useState<"gasto" | "ganho">("gasto");
  const [simValue, setSimValue] = useState("");
  const [simFrom, setSimFrom] = useState(months[0] ?? selected);
  const [simMonths, setSimMonths] = useState("3");

  const sim = parseMoney(simValue) ?? 0;
  const startBalance = parseMoney(start) ?? 0;

  const rows = useMemo(() => {
    const simRange = new Set(
      sim > 0 ? Array.from({ length: Number(simMonths) || 1 }, (_, i) => addMonths(simFrom, i)) : []
    );
    let acc = startBalance;
    return balances.map((b) => {
      const delta = simRange.has(b.monthRef) ? (simKind === "gasto" ? -sim : sim) : 0;
      const left = b.left + delta;
      acc += left;
      return { ...b, delta, leftSim: left, acc };
    });
  }, [balances, sim, simKind, simFrom, simMonths, startBalance]);

  const simulating = sim > 0;
  const uid = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-paper">
        <table className="w-full min-w-[640px] whitespace-nowrap text-[13px]">
          <thead>
            <tr className="border-b border-border text-ink-muted">
              <th className="px-4 py-2 text-left font-medium" />
              {rows.map((r) => (
                <th
                  key={r.monthRef}
                  className={cn("px-3 py-2 text-right font-medium", r.monthRef === selected && "text-ink")}
                >
                  {monthShort(r.monthRef)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <CalcRow label="Entradas" values={rows.map((r) => r.income)} />
            <CalcRow label="Contas PJ" values={rows.map((r) => -r.outPj)} muted blankZero />
            <CalcRow label="Contas PF" values={rows.map((r) => -r.outPf)} muted blankZero />
            {simulating && (
              <CalcRow
                label={simKind === "gasto" ? "Simulação (gasto)" : "Simulação (ganho)"}
                values={rows.map((r) => r.delta)}
                muted
                blankZero
              />
            )}
            <tr className="border-t border-border font-semibold">
              <td className="px-4 py-2.5 text-ink">Sobra do mês</td>
              {rows.map((r) => (
                <td
                  key={r.monthRef}
                  className={cn("px-3 py-2.5 text-right", r.leftSim < 0 ? "text-coral" : "text-ink")}
                >
                  {money(r.leftSim)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-border/70 text-ink-muted">
              <td className="px-4 py-2">Acumulado</td>
              {rows.map((r) => (
                <td key={r.monthRef} className={cn("px-3 py-2 text-right", r.acc < 0 && "text-coral")}>
                  {money(r.acc)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-paper p-4 sm:grid-cols-[1.1fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-start`}>Saldo em conta hoje</Label>
          <Input
            id={`${uid}-start`}
            inputMode="decimal"
            placeholder="0,00"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-kind`}>Simular</Label>
          <Select id={`${uid}-kind`} value={simKind} onChange={(e) => setSimKind(e.target.value as "gasto" | "ganho")}>
            <option value="gasto">Um gasto novo</option>
            <option value="ganho">Uma entrada nova</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-val`}>Valor por mês</Label>
          <Input
            id={`${uid}-val`}
            inputMode="decimal"
            placeholder="800,00"
            value={simValue}
            onChange={(e) => setSimValue(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-from`}>A partir de</Label>
          <Select id={`${uid}-from`} value={simFrom} onChange={(e) => setSimFrom(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-n`}>Por quantos meses</Label>
          <Select id={`${uid}-n`} value={simMonths} onChange={(e) => setSimMonths(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 mês" : `${n} meses`}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="text-[12px] text-ink-faint">
        A simulação não grava nada: serve para testar uma compra parcelada ou um contrato novo antes
        de lançar.
      </p>
    </div>
  );
}

function CalcRow({
  label,
  values,
  muted,
  blankZero,
}: {
  label: string;
  values: number[];
  muted?: boolean;
  blankZero?: boolean;
}) {
  return (
    <tr className="border-b border-border/70">
      <td className={cn("px-4 py-2", muted ? "text-ink-muted" : "text-ink")}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={cn("px-3 py-2 text-right", muted ? "text-ink-muted" : "text-ink")}>
          {blankZero && v === 0 ? "—" : money(v)}
        </td>
      ))}
    </tr>
  );
}
