import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { financeEntries } from "@/lib/db/schema";
import { Stat } from "@/components/ui/card";
import {
  BalanceCalculator,
  CopyOutflowsButton,
  EntriesTable,
  EntryDialog,
  OutflowsTable,
  type EntryData,
} from "@/components/erp";
import { brl, currentMonthRef, monthLabel } from "@/lib/format";
import { addMonths, DEFAULT_PAYERS, type Direction, money, monthBalances, monthShort, payerColor } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ErpPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const current = currentMonthRef();
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : current;

  const rows = await db
    .select()
    .from(financeEntries)
    .orderBy(asc(financeEntries.monthRef), asc(financeEntries.payer), asc(financeEntries.id));

  const all: EntryData[] = rows.map((r) => ({
    id: r.id,
    direction: (r.direction === "saida" ? "saida" : "entrada") as Direction,
    entity: r.entity,
    payer: r.payer,
    kind: r.kind,
    description: r.description,
    amount: Number(r.amount),
    monthRef: r.monthRef,
    nfStatus: r.nfStatus,
    nfNumber: r.nfNumber,
    nfIssuedAt: r.nfIssuedAt,
    received: r.received,
    receivedAt: r.receivedAt,
    notes: r.notes,
  }));

  const entries = all.filter((e) => e.direction === "entrada");
  const outflows = all.filter((e) => e.direction === "saida");

  // pagadores: os de sempre primeiro, depois os que forem aparecendo
  const payers = [...DEFAULT_PAYERS];
  for (const e of entries) if (!payers.includes(e.payer)) payers.push(e.payer);

  const order = (p: string) => payers.indexOf(p);
  const ofMonth = entries
    .filter((e) => e.monthRef === month)
    .sort((a, b) => order(a.payer) - order(b.payer));
  const expected = ofMonth.reduce((s, e) => s + e.amount, 0);
  const received = ofMonth.filter((e) => e.received).reduce((s, e) => s + e.amount, 0);
  const toReceive = expected - received;
  const nfPending = ofMonth.filter((e) => e.nfStatus === "pendente").length;
  const nfDue = month <= current;

  // saídas: contas conhecidas viram opções no formulário
  const billNames: string[] = [];
  for (const e of outflows) if (!billNames.includes(e.payer)) billNames.push(e.payer);
  const outOfMonth = outflows
    .filter((e) => e.monthRef === month)
    .sort((a, b) => (a.entity === b.entity ? a.id - b.id : a.entity === "pj" ? -1 : 1));
  const outPj = outOfMonth.filter((e) => e.entity === "pj").reduce((s, e) => s + e.amount, 0);
  const outPf = outOfMonth.filter((e) => e.entity !== "pj").reduce((s, e) => s + e.amount, 0);
  const left = expected - outPj - outPf;
  const prevHasOut = outflows.some((e) => e.monthRef === addMonths(month, -1));

  // NFs atrasadas de meses anteriores também pedem atenção
  const nfLate = entries.filter((e) => e.nfStatus === "pendente" && e.monthRef < current);

  // visão de 6 meses, a partir do mês atual (como a planilha)
  const horizon = Array.from({ length: 6 }, (_, i) => addMonths(current, i));
  const matrixPayers = payers.filter((p) =>
    entries.some((e) => e.payer === p && horizon.includes(e.monthRef))
  );
  const cell = (p: string, m: string) =>
    entries.filter((e) => e.payer === p && e.monthRef === m);
  const totalOf = (m: string) =>
    entries.filter((e) => e.monthRef === m).reduce((s, e) => s + e.amount, 0);

  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  // calculadora: do mês atual até o último mês com lançamento (mínimo 6)
  const lastMonth = all.reduce((m, e) => (e.monthRef > m ? e.monthRef : m), current);
  const calcMonths: string[] = [];
  for (let m = current; m <= lastMonth || calcMonths.length < 6; m = addMonths(m, 1)) {
    calcMonths.push(m);
    if (calcMonths.length >= 12) break;
  }
  const balances = monthBalances(all, calcMonths);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.025em]">ERP</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Entradas e contas fixas da PJ e da PF, e quanto sobra em cada mês.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EntryDialog direction="saida" names={billNames} defaultMonth={month} />
          <EntryDialog direction="entrada" names={payers} defaultMonth={month} />
        </div>
      </header>

      <div className="flex items-center gap-1">
        <Link
          prefetch={false}
          href={`/erp?mes=${prev}`}
          className="rounded-md p-1.5 text-ink-muted hover:bg-black/[0.05] hover:text-ink"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h2 className="min-w-[150px] text-center font-display text-[16px] font-semibold text-ink">
          {monthLabel(month)}
        </h2>
        <Link
          prefetch={false}
          href={`/erp?mes=${next}`}
          className="rounded-md p-1.5 text-ink-muted hover:bg-black/[0.05] hover:text-ink"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
        {month !== current && (
          <Link
            prefetch={false}
            href="/erp"
            className="ml-2 text-[12.5px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Voltar para o mês atual
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Entradas do mês" value={brl(expected)} note={received > 0 ? `${brl(received)} já recebido` : undefined} />
        <Stat label="Contas PJ" value={brl(outPj)} />
        <Stat label="Contas PF" value={brl(outPf)} />
        <Stat
          label={left < 0 ? "Falta no mês" : "Sobra no mês"}
          value={brl(Math.abs(left))}
          tone={left < 0 ? "attention" : outOfMonth.length > 0 && left > 0 ? "money" : "default"}
        />
      </div>

      {nfLate.length > 0 && (
        <p className="rounded-md bg-attention-bg px-3 py-2 text-[13px] text-coral">
          {nfLate.length === 1 ? "1 nota fiscal" : `${nfLate.length} notas fiscais`} de meses
          anteriores ainda sem emitir:{" "}
          {nfLate
            .map((e) => `${e.payer} (${monthShort(e.monthRef)})`)
            .join(", ")}
          .
        </p>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[15px] font-semibold text-ink">Entradas</h3>
          <p className="text-[12.5px] text-ink-muted">
            {toReceive > 0 ? `${brl(toReceive)} a receber` : "Tudo recebido"}
            {nfPending > 0 &&
              `, ${nfPending} ${nfPending === 1 ? "nota fiscal a emitir" : "notas fiscais a emitir"}`}
          </p>
        </div>
        {ofMonth.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-paper p-6 text-center text-[13.5px] text-ink-muted">
            Nada lançado em {monthLabel(month).toLowerCase()}. Use &ldquo;Nova entrada&rdquo;;
            dá para repetir um salário fixo por vários meses de uma vez.
          </div>
        ) : (
          <EntriesTable entries={ofMonth} names={payers} nfDue={nfDue} />
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">Contas fixas</h3>
            <p className="text-[12.5px] text-ink-muted">
              Clique no valor para trocar: cartão de crédito, conta que veio diferente.
            </p>
          </div>
          {prevHasOut && <CopyOutflowsButton from={prev} to={month} />}
        </div>
        {outOfMonth.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-paper p-6 text-center text-[13.5px] text-ink-muted">
            Nenhuma conta em {monthLabel(month).toLowerCase()}.{" "}
            {prevHasOut
              ? "Copie as contas do mês anterior e ajuste os cartões."
              : "Use “Nova saída” para lançar."}
          </div>
        ) : (
          <OutflowsTable entries={outOfMonth} names={billNames} />
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink">Quanto sobra, mês a mês</h3>
          <p className="text-[12.5px] text-ink-muted">
            Entradas menos as contas da PJ e da PF. Meses sem contas lançadas ainda não mostram o
            gasto real.
          </p>
        </div>
        <BalanceCalculator balances={balances} selected={month} />
      </section>

      {matrixPayers.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">Entradas nos próximos 6 meses</h3>
            <p className="text-[12.5px] text-ink-muted">
              O ponto mostra a nota fiscal: preenchido é emitida, vazado é a emitir.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-paper">
            <table className="w-full min-w-[640px] whitespace-nowrap text-[13px]">
              <thead>
                <tr className="border-b border-border text-ink-muted">
                  <th className="px-4 py-2 text-left font-medium">Quem paga</th>
                  {horizon.map((m) => (
                    <th
                      key={m}
                      className={cn(
                        "px-3 py-2 text-right font-medium",
                        m === month && "text-ink"
                      )}
                    >
                      <Link prefetch={false} href={`/erp?mes=${m}`} className="hover:underline">
                        {monthShort(m)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixPayers.map((p) => (
                  <tr key={p} className="border-b border-border/70">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 text-ink">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: payerColor(p) }}
                        />
                        {p}
                      </span>
                    </td>
                    {horizon.map((m) => {
                      const list = cell(p, m);
                      if (list.length === 0)
                        return (
                          <td key={m} className="px-3 py-2 text-right text-ink-faint">
                            —
                          </td>
                        );
                      const sum = list.reduce((s, e) => s + e.amount, 0);
                      const nf = list.filter((e) => e.nfStatus !== "nao_aplica");
                      const issued = nf.length > 0 && nf.every((e) => e.nfStatus === "emitida");
                      const late = !issued && nf.length > 0 && m <= current;
                      return (
                        <td key={m} className="px-3 py-2 text-right tabular-nums text-ink">
                          <span className="inline-flex items-center gap-1.5">
                            {money(sum)}
                            {nf.length > 0 && (
                              <span
                                title={issued ? "NF emitida" : "NF a emitir"}
                                className={cn(
                                  "h-2 w-2 rounded-full border",
                                  issued
                                    ? "border-navy bg-navy"
                                    : late
                                      ? "border-coral"
                                      : "border-ink-faint"
                                )}
                              />
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-4 py-2.5 text-ink">Total</td>
                  {horizon.map((m) => (
                    <td key={m} className="px-3 py-2.5 text-right tabular-nums text-ink">
                      {money(totalOf(m))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
