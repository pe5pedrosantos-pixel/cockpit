"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { financeEntries } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { addMonths, FINANCE_KINDS, NF_STATUS, OUT_KINDS, parseMoney } from "@/lib/finance";
import { monthLabel, todayISO } from "@/lib/format";

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

function revalidateAll() {
  revalidatePath("/erp");
  revalidatePath("/");
}

type Result = { ok: boolean; message: string };

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const entrySchema = z
  .object({
    direction: z.enum(["entrada", "saida"]).default("entrada"),
    payer: z.string().trim().min(1, "Informe o nome").max(80),
    kind: z.string(),
    entity: z.enum(["pj", "pf"]).default("pj"),
    description: opt(160),
    amount: z
      .string()
      .transform((v) => parseMoney(v))
      .refine((v): v is number => v !== null && v > 0, "Informe o valor"),
    monthRef: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido"),
    nfStatus: z.string().optional().default("nao_aplica"),
    nfNumber: opt(40),
    notes: opt(1000),
  })
  .refine(
    (d) => (d.direction === "entrada" ? d.kind in FINANCE_KINDS : d.kind in OUT_KINDS),
    { message: "Tipo inválido", path: ["kind"] }
  )
  .refine((d) => d.nfStatus in NF_STATUS, { message: "Status de NF inválido", path: ["nfStatus"] })
  .transform((d) => (d.direction === "saida" ? { ...d, nfStatus: "nao_aplica", nfNumber: null } : d));

function parse(fd: FormData) {
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  // nome digitado à mão ("Outro…") tem prioridade sobre o select
  if (raw.payer === "__outro") raw.payer = raw.payerOther ?? "";
  return entrySchema.safeParse(raw);
}

export async function createEntry(fd: FormData): Promise<Result> {
  await requireAuth();
  const parsed = parse(fd);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  // repetir: lança o mesmo valor nos meses seguintes (salário, aluguel, parcela)
  const repeat = Math.min(Math.max(Number(fd.get("repeat") ?? 1) || 1, 1), 24);
  const rows = Array.from({ length: repeat }, (_, i) => ({
    direction: d.direction,
    entity: d.entity,
    payer: d.payer,
    kind: d.kind,
    description: d.description,
    amount: String(d.amount),
    monthRef: addMonths(d.monthRef, i),
    // só o primeiro mês herda a NF informada; os seguintes começam a emitir
    nfStatus: i === 0 ? d.nfStatus : d.nfStatus === "nao_aplica" ? "nao_aplica" : "pendente",
    nfNumber: i === 0 ? d.nfNumber : null,
    nfIssuedAt: i === 0 && d.nfStatus === "emitida" ? todayISO() : null,
    notes: d.notes,
  }));
  await db.insert(financeEntries).values(rows);
  revalidateAll();
  const what = d.direction === "saida" ? "saída" : "entrada";
  return {
    ok: true,
    message: repeat > 1 ? `${repeat} lançamentos de ${what}.` : `${what[0].toUpperCase()}${what.slice(1)} lançada.`,
  };
}

export async function updateEntry(id: number, fd: FormData): Promise<Result> {
  await requireAuth();
  const parsed = parse(fd);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const [current] = await db.select().from(financeEntries).where(eq(financeEntries.id, id));
  if (!current) return { ok: false, message: "Lançamento não encontrado." };
  await db
    .update(financeEntries)
    .set({
      entity: d.entity,
      payer: d.payer,
      kind: d.kind,
      description: d.description,
      amount: String(d.amount),
      monthRef: d.monthRef,
      nfStatus: d.nfStatus,
      nfNumber: d.nfNumber,
      nfIssuedAt: d.nfStatus === "emitida" ? current.nfIssuedAt ?? todayISO() : null,
      notes: d.notes,
      updatedAt: new Date(),
    })
    .where(eq(financeEntries.id, id));
  revalidateAll();
  return { ok: true, message: "Lançamento atualizado." };
}

/** Troca só o valor (fatura do cartão que mudou, conta que veio diferente). */
export async function updateAmount(id: number, raw: string): Promise<Result> {
  await requireAuth();
  const value = parseMoney(raw);
  if (value === null || value <= 0) return { ok: false, message: "Valor inválido." };
  await db
    .update(financeEntries)
    .set({ amount: String(value), updatedAt: new Date() })
    .where(eq(financeEntries.id, id));
  revalidateAll();
  return { ok: true, message: "" };
}

/** Marca a NF como emitida (ou volta para "a emitir"). */
export async function setNfStatus(id: number, status: string): Promise<Result> {
  await requireAuth();
  if (!(status in NF_STATUS)) return { ok: false, message: "Status inválido." };
  await db
    .update(financeEntries)
    .set({
      nfStatus: status,
      nfIssuedAt: status === "emitida" ? todayISO() : null,
      updatedAt: new Date(),
    })
    .where(eq(financeEntries.id, id));
  revalidateAll();
  return { ok: true, message: "" };
}

/** Entrada: dinheiro recebido. Saída: conta paga. */
export async function setReceived(id: number, received: boolean): Promise<Result> {
  await requireAuth();
  await db
    .update(financeEntries)
    .set({
      received,
      receivedAt: received ? todayISO() : null,
      updatedAt: new Date(),
    })
    .where(eq(financeEntries.id, id));
  revalidateAll();
  return { ok: true, message: "" };
}

/**
 * Copia as saídas de um mês para o seguinte (contas fixas que se repetem).
 * Não duplica: pula o que já existe no destino com o mesmo nome e conta.
 */
export async function copyOutflows(fromMonth: string, toMonth: string): Promise<Result> {
  await requireAuth();
  const source = await db
    .select()
    .from(financeEntries)
    .where(and(eq(financeEntries.direction, "saida"), eq(financeEntries.monthRef, fromMonth)))
    .orderBy(asc(financeEntries.id));
  if (source.length === 0) return { ok: false, message: `Nada de saída em ${monthLabel(fromMonth)} para copiar.` };
  const existing = await db
    .select({ payer: financeEntries.payer, entity: financeEntries.entity })
    .from(financeEntries)
    .where(and(eq(financeEntries.direction, "saida"), eq(financeEntries.monthRef, toMonth)));
  const key = (p: string, e: string) => `${e}|${p.trim().toLowerCase()}`;
  const have = new Set(existing.map((x) => key(x.payer, x.entity)));
  const rows = source
    .filter((s) => !have.has(key(s.payer, s.entity)))
    .map((s) => ({
      direction: "saida",
      entity: s.entity,
      payer: s.payer,
      kind: s.kind,
      description: s.description,
      amount: s.amount,
      monthRef: toMonth,
      nfStatus: "nao_aplica",
      notes: s.notes,
    }));
  if (rows.length === 0) return { ok: true, message: "Esse mês já tem todas as contas." };
  await db.insert(financeEntries).values(rows);
  revalidateAll();
  return { ok: true, message: `${rows.length} contas copiadas. Ajuste os cartões quando a fatura fechar.` };
}

export async function deleteEntry(id: number): Promise<Result> {
  await requireAuth();
  await db.delete(financeEntries).where(eq(financeEntries.id, id));
  revalidateAll();
  return { ok: true, message: "Lançamento removido." };
}
