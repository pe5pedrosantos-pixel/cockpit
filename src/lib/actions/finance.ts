"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { financeEntries } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { addMonths, FINANCE_KINDS, NF_STATUS, parseMoney } from "@/lib/finance";
import { todayISO } from "@/lib/format";

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

const entrySchema = z.object({
  payer: z.string().trim().min(1, "Informe quem paga").max(80),
  kind: z.string().refine((k) => k in FINANCE_KINDS, "Tipo inválido"),
  entity: z.enum(["pj", "pf"]).default("pj"),
  description: opt(160),
  amount: z
    .string()
    .transform((v) => parseMoney(v))
    .refine((v): v is number => v !== null && v > 0, "Informe o valor"),
  monthRef: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido"),
  nfStatus: z.string().refine((s) => s in NF_STATUS, "Status de NF inválido"),
  nfNumber: opt(40),
  notes: opt(1000),
});

function parse(fd: FormData) {
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  // "Outro pagador" digitado à mão tem prioridade sobre o select
  if (raw.payer === "__outro") raw.payer = raw.payerOther ?? "";
  return entrySchema.safeParse(raw);
}

export async function createEntry(fd: FormData): Promise<Result> {
  await requireAuth();
  const parsed = parse(fd);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  // repetir: lança o mesmo valor nos meses seguintes (ex.: salário fixo)
  const repeat = Math.min(Math.max(Number(fd.get("repeat") ?? 1) || 1, 1), 24);
  const rows = Array.from({ length: repeat }, (_, i) => ({
    direction: "entrada",
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
  return {
    ok: true,
    message: repeat > 1 ? `${repeat} entradas lançadas.` : "Entrada lançada.",
  };
}

export async function updateEntry(id: number, fd: FormData): Promise<Result> {
  await requireAuth();
  const parsed = parse(fd);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const [current] = await db.select().from(financeEntries).where(eq(financeEntries.id, id));
  if (!current) return { ok: false, message: "Entrada não encontrada." };
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
      nfIssuedAt:
        d.nfStatus === "emitida" ? current.nfIssuedAt ?? todayISO() : null,
      notes: d.notes,
      updatedAt: new Date(),
    })
    .where(eq(financeEntries.id, id));
  revalidateAll();
  return { ok: true, message: "Entrada atualizada." };
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

/** Marca o dinheiro como recebido (ou desfaz). */
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

export async function deleteEntry(id: number): Promise<Result> {
  await requireAuth();
  await db.delete(financeEntries).where(eq(financeEntries.id, id));
  revalidateAll();
  return { ok: true, message: "Entrada removida." };
}
