"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { activities, pipelineDeals } from "@/lib/db/schema";
import { toPipedriveDue } from "@/lib/activities";
import { getDealActivities } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { syncPipedrive, type SyncResult } from "@/lib/pipedrive/sync";
import {
  getPipedriveConfig,
  pipedrive,
  PipedriveError,
} from "@/lib/pipedrive/client";

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/funil");
  revalidatePath("/integracoes");
  revalidatePath("/clientes");
}

export async function syncPipedriveAction(): Promise<SyncResult> {
  await requireAuth();
  const result = await syncPipedrive();
  revalidateAll();
  return result;
}

// ─── Criação de negócio ───────────────────────────────────────────────────

const newDealSchema = z.object({
  title: z.string().min(1, "Informe o título do negócio").max(255),
  orgName: z.string().max(255).optional().nullable(),
  personName: z.string().max(255).optional().nullable(),
  value: z.coerce.number().min(0).optional().nullable(),
  pipelineId: z.coerce.number().int().positive().optional().nullable(),
  stageId: z.coerce.number().int().positive().optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
});

export interface CreateDealResult {
  ok: boolean;
  message: string;
}

/**
 * Cria o negócio DIRETO no Pipedrive e depois sincroniza.
 *
 * Nunca gravamos um negócio que exista apenas aqui: o Pipedrive continua
 * sendo a fonte única de verdade do funil da SOBE.
 */
export async function createDealAction(
  formData: FormData
): Promise<CreateDealResult> {
  await requireAuth();

  const config = getPipedriveConfig();
  if (!config) {
    return { ok: false, message: "Pipedrive não configurado." };
  }

  let data: z.infer<typeof newDealSchema>;
  try {
    const raw = Object.fromEntries(formData.entries());
    data = newDealSchema.parse({
      ...raw,
      value: raw.value === "" ? null : raw.value,
      pipelineId: raw.pipelineId || null,
      stageId: raw.stageId || null,
      expectedCloseDate: raw.expectedCloseDate || null,
      orgName: raw.orgName || null,
      personName: raw.personName || null,
    });
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? (e.issues[0]?.message ?? "Dados inválidos.")
        : "Dados inválidos.";
    return { ok: false, message: msg };
  }

  try {
    const org = data.orgName
      ? await pipedrive.findOrCreateOrganization(config, data.orgName)
      : null;

    const person = data.personName
      ? await pipedrive.findOrCreatePerson(config, data.personName, org?.id)
      : null;

    const deal = await pipedrive.createDeal(config, {
      title: data.title,
      value: data.value ?? null,
      currency: "BRL",
      org_id: org?.id ?? null,
      person_id: person?.id ?? null,
      pipeline_id: data.pipelineId ?? null,
      stage_id: data.stageId ?? null,
      expected_close_date: data.expectedCloseDate ?? null,
    });

    // traz o registro recém-criado (e o resto) para o banco local
    await syncPipedrive();
    revalidateAll();

    return {
      ok: true,
      message: `"${deal.title}" criado no Pipedrive${
        org ? ` para ${org.name}` : ""
      }.`,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof PipedriveError
          ? e.message
          : "Não foi possível criar o negócio no Pipedrive.",
    };
  }
}

// ─── Anotações locais de recorrência ──────────────────────────────────────

/**
 * Marca um negócio como receita recorrente e guarda o valor mensal.
 * É uma anotação local — o Pipedrive não tem esse conceito por padrão e a
 * sincronização preserva estes campos.
 */
export async function setDealRecurrence(
  dealId: number,
  isRecurring: boolean,
  monthlyValue?: number | null
) {
  await requireAuth();
  await db
    .update(pipelineDeals)
    .set({
      isRecurring,
      monthlyValue:
        isRecurring && monthlyValue != null && monthlyValue > 0
          ? String(monthlyValue)
          : null,
    })
    .where(eq(pipelineDeals.id, dealId));
  revalidateAll();
}

// ─── CRM: atividades e notas ──────────────────────────────────────────────

export interface CrmResult {
  ok: boolean;
  message: string;
}

function crmError(e: unknown, fallback: string): CrmResult {
  return {
    ok: false,
    message: e instanceof PipedriveError ? e.message : fallback,
  };
}

/** Tipos de atividade da conta, para o seletor do formulário. */
export async function getActivityTypesAction(): Promise<
  { key: string; name: string }[]
> {
  await requireAuth();
  const config = getPipedriveConfig();
  if (!config) return [];
  const types = await pipedrive.activityTypes(config);
  return types
    .sort((a, b) => (a.order_nr ?? 0) - (b.order_nr ?? 0))
    .map((t) => ({ key: t.key_string, name: t.name }));
}

const newActivitySchema = z.object({
  subject: z.string().trim().min(1, "Informe o assunto da atividade").max(255),
  type: z.string().min(1).default("call"),
  dealPipedriveId: z.coerce.number().int().positive().optional().nullable(),
  orgPipedriveId: z.coerce.number().int().positive().optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  dueTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  note: z.string().max(5000).optional().nullable(),
});

/** Cria a atividade no Pipedrive e sincroniza em seguida. */
export async function createActivityAction(formData: FormData): Promise<CrmResult> {
  await requireAuth();
  const config = getPipedriveConfig();
  if (!config) return { ok: false, message: "Pipedrive não configurado." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = newActivitySchema.safeParse({
    ...raw,
    dealPipedriveId: raw.dealPipedriveId || null,
    orgPipedriveId: raw.orgPipedriveId || null,
    dueTime: raw.dueTime || null,
    note: raw.note || null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  try {
    const due = toPipedriveDue(data.dueDate, data.dueTime);
    await pipedrive.createActivity(config, {
      subject: data.subject,
      type: data.type,
      deal_id: data.dealPipedriveId ?? null,
      org_id: data.dealPipedriveId ? null : (data.orgPipedriveId ?? null),
      due_date: due.due_date,
      due_time: due.due_time,
      note: data.note ?? null,
    });
    // a sincronização atualiza também o "próximo passo" do negócio
    await syncPipedrive();
    revalidateAll();
    return { ok: true, message: `Atividade "${data.subject}" criada no Pipedrive.` };
  } catch (e) {
    return crmError(e, "Não foi possível criar a atividade no Pipedrive.");
  }
}

/**
 * Marca a atividade como concluída (ou reabre). Atualiza o banco local na
 * hora e deixa a sincronização completa para depois da resposta.
 */
export async function setActivityDoneAction(
  activityId: number,
  done: boolean
): Promise<CrmResult> {
  await requireAuth();
  const config = getPipedriveConfig();
  if (!config) return { ok: false, message: "Pipedrive não configurado." };

  const [row] = await db
    .select({ pipedriveId: activities.pipedriveId, subject: activities.subject })
    .from(activities)
    .where(eq(activities.id, activityId));
  if (!row?.pipedriveId) {
    return { ok: false, message: "Atividade não encontrada. Sincronize e tente de novo." };
  }

  try {
    await pipedrive.setActivityDone(config, row.pipedriveId, done);
  } catch (e) {
    return crmError(e, "Não foi possível atualizar a atividade no Pipedrive.");
  }

  await db.update(activities).set({ done }).where(eq(activities.id, activityId));
  after(async () => {
    await syncPipedrive();
    revalidateAll();
  });
  revalidateAll();
  return {
    ok: true,
    message: done ? `"${row.subject}" concluída.` : `"${row.subject}" reaberta.`,
  };
}

const noteSchema = z.object({
  content: z.string().trim().min(1, "Escreva a nota").max(20000),
  dealPipedriveId: z.coerce.number().int().positive().optional().nullable(),
  orgPipedriveId: z.coerce.number().int().positive().optional().nullable(),
});

/** Registra uma nota no histórico do negócio (ou da organização). */
export async function addNoteAction(formData: FormData): Promise<CrmResult> {
  await requireAuth();
  const config = getPipedriveConfig();
  if (!config) return { ok: false, message: "Pipedrive não configurado." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = noteSchema.safeParse({
    ...raw,
    dealPipedriveId: raw.dealPipedriveId || null,
    orgPipedriveId: raw.orgPipedriveId || null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { content, dealPipedriveId, orgPipedriveId } = parsed.data;
  if (!dealPipedriveId && !orgPipedriveId) {
    return { ok: false, message: "A nota precisa estar ligada a um negócio ou cliente." };
  }

  // o Pipedrive aceita HTML nas notas; quebras de linha viram <br>
  const html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");

  try {
    await pipedrive.addNote(config, {
      content: html,
      deal_id: dealPipedriveId ?? null,
      org_id: orgPipedriveId ?? null,
    });
    return { ok: true, message: "Nota registrada no Pipedrive." };
  } catch (e) {
    return crmError(e, "Não foi possível registrar a nota no Pipedrive.");
  }
}

/** Atividades de um negócio, lidas do banco local (para o detalhe no funil). */
export async function getDealActivitiesAction(dealId: number) {
  await requireAuth();
  return getDealActivities(dealId);
}
