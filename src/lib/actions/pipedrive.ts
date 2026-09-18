"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { pipelineDeals } from "@/lib/db/schema";
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
