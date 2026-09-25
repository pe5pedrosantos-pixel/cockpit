"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leadNotes, leads } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { isStage, stageLabel } from "@/lib/leads";

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

function revalidateAll() {
  revalidatePath("/leads");
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

const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  email: opt(160),
  phone: opt(40),
  organization: opt(160),
  role: opt(120),
  interest: opt(40),
  source: opt(40),
  value: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null;
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? String(n) : null;
    }),
  eventDate: opt(10),
  nextStep: opt(200),
  nextStepDate: opt(10),
  message: opt(4000),
});

function parseLead(fd: FormData) {
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  return leadSchema.safeParse(raw);
}

export async function createLead(fd: FormData): Promise<Result> {
  await requireAuth();
  const parsed = parseLead(fd);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const stage = String(fd.get("stage") ?? "novo");
  await db.insert(leads).values({
    ...d,
    email: d.email?.toLowerCase() ?? null,
    source: d.source ?? "manual",
    stage: isStage(stage) ? stage : "novo",
    seen: true,
  });
  revalidateAll();
  return { ok: true, message: `${d.name} entrou no funil.` };
}

export async function updateLead(id: number, fd: FormData): Promise<Result> {
  await requireAuth();
  const parsed = parseLead(fd);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  await db
    .update(leads)
    .set({
      ...d,
      email: d.email?.toLowerCase() ?? null,
      source: d.source ?? "manual",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));
  revalidateAll();
  return { ok: true, message: "Lead atualizado." };
}

export async function moveLead(id: number, stage: string, lostReason?: string | null): Promise<Result> {
  await requireAuth();
  if (!isStage(stage)) return { ok: false, message: "Etapa inválida." };
  const [current] = await db.select({ stage: leads.stage }).from(leads).where(eq(leads.id, id));
  if (!current) return { ok: false, message: "Lead não encontrado." };
  if (current.stage === stage) return { ok: true, message: "" };

  await db
    .update(leads)
    .set({
      stage,
      stageChangedAt: new Date(),
      updatedAt: new Date(),
      seen: true,
      ...(stage === "perdido" ? { lostReason: lostReason?.trim() || null } : {}),
    })
    .where(eq(leads.id, id));
  await db.insert(leadNotes).values({
    leadId: id,
    content: `Etapa: ${stageLabel(current.stage)} → ${stageLabel(stage)}${
      stage === "perdido" && lostReason ? ` (motivo: ${lostReason.trim()})` : ""
    }`,
  });
  revalidateAll();
  return { ok: true, message: `Movido para ${stageLabel(stage)}.` };
}

export async function markLeadSeen(id: number) {
  await requireAuth();
  await db.update(leads).set({ seen: true }).where(eq(leads.id, id));
  revalidateAll();
}

export async function addLeadNote(id: number, content: string): Promise<Result> {
  await requireAuth();
  const text = content.trim();
  if (!text) return { ok: false, message: "Escreva a nota." };
  await db.insert(leadNotes).values({ leadId: id, content: text.slice(0, 5000) });
  await db.update(leads).set({ updatedAt: new Date(), seen: true }).where(eq(leads.id, id));
  revalidateAll();
  return { ok: true, message: "Nota registrada." };
}

export async function getLeadNotes(id: number) {
  await requireAuth();
  return db
    .select({ id: leadNotes.id, content: leadNotes.content, createdAt: leadNotes.createdAt })
    .from(leadNotes)
    .where(eq(leadNotes.leadId, id))
    .orderBy(desc(leadNotes.createdAt));
}

export async function deleteLead(id: number): Promise<Result> {
  await requireAuth();
  await db.delete(leads).where(eq(leads.id, id));
  revalidateAll();
  return { ok: true, message: "Lead removido." };
}
