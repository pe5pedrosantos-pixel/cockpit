/**
 * Sincronização Pipedrive → banco local.
 *
 * Fluxo: PIPEDRIVE → API/SERVICE → BANCO LOCAL → PLATAFORMA.
 * As telas leem sempre do banco local, nunca da API direto.
 *
 * Importante: na API v2 o objeto do negócio traz apenas os IDs de
 * organização, pessoa e responsável (os nomes foram removidos). Por isso
 * buscamos essas coleções e resolvemos os nomes aqui, antes de gravar.
 */

import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities, integrations, pipelineDeals } from "@/lib/db/schema";
import {
  getPipedriveConfig,
  pipedrive,
  PipedriveError,
  type PdActivity,
} from "./client";

export interface SyncResult {
  ok: boolean;
  deals: number;
  activities: number;
  message: string;
  syncedAt: Date;
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Junta due_date + due_time do Pipedrive num timestamp. */
function activityDueAt(a: PdActivity): Date | null {
  if (!a.due_date) return null;
  const iso = a.due_time
    ? `${a.due_date}T${a.due_time.length === 5 ? a.due_time : a.due_time.slice(0, 5)}:00`
    : `${a.due_date}T00:00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function recordStatus(
  status: "connected" | "error" | "disconnected",
  meta: Record<string, unknown>,
  syncedAt?: Date
) {
  await db
    .insert(integrations)
    .values({
      provider: "pipedrive",
      status,
      lastSyncAt: syncedAt ?? null,
      meta,
    })
    .onConflictDoUpdate({
      target: integrations.provider,
      set: {
        status,
        meta,
        ...(syncedAt ? { lastSyncAt: syncedAt } : {}),
      },
    });
}

export async function syncPipedrive(): Promise<SyncResult> {
  const syncedAt = new Date();
  const config = getPipedriveConfig();

  if (!config) {
    const message =
      "Pipedrive não configurado. Defina PIPEDRIVE_API_TOKEN e PIPEDRIVE_COMPANY_DOMAIN.";
    await recordStatus("disconnected", { lastError: message });
    return { ok: false, deals: 0, activities: 0, message, syncedAt };
  }

  try {
    const [pipelines, stages, deals, persons, orgs, users, acts] =
      await Promise.all([
        pipedrive.pipelines(config),
        pipedrive.stages(config),
        pipedrive.deals(config),
        pipedrive.persons(config),
        pipedrive.organizations(config),
        pipedrive.users(config),
        pipedrive.activities(config),
      ]);

    const pipelineName = new Map(pipelines.map((p) => [p.id, p.name]));
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const personName = new Map(persons.map((p) => [p.id, p.name ?? null]));
    const orgName = new Map(orgs.map((o) => [o.id, o.name ?? null]));
    const userName = new Map(users.map((u) => [u.id, u.name ?? null]));
    const activityById = new Map(acts.map((a) => [a.id, a]));

    const liveDeals = deals.filter((d) => !d.is_deleted);

    // ── Negócios ──────────────────────────────────────────────────────────
    const dealRows = liveDeals.map((d) => {
      const stage = d.stage_id ? stageById.get(d.stage_id) : undefined;
      const nextAct = d.next_activity_id
        ? activityById.get(d.next_activity_id)
        : undefined;
      const lastAct = d.last_activity_id
        ? activityById.get(d.last_activity_id)
        : undefined;

      return {
        pipedriveId: d.id,
        title: d.title || "(sem título)",
        orgId: d.org_id ?? null,
        orgName: d.org_id ? (orgName.get(d.org_id) ?? null) : null,
        personId: d.person_id ?? null,
        personName: d.person_id ? (personName.get(d.person_id) ?? null) : null,
        ownerId: d.owner_id ?? null,
        ownerName: d.owner_id ? (userName.get(d.owner_id) ?? null) : null,
        value: d.value != null ? String(d.value) : null,
        currency: d.currency ?? "BRL",
        pipelineId: d.pipeline_id ?? null,
        pipelineName: d.pipeline_id
          ? (pipelineName.get(d.pipeline_id) ?? null)
          : null,
        stageId: d.stage_id ?? null,
        stageName: stage?.name ?? null,
        stageOrder: stage?.order_nr ?? null,
        status: d.status ?? "open",
        expectedCloseDate: d.expected_close_date ?? null,
        lastActivityAt: lastAct ? activityDueAt(lastAct) : null,
        nextActivityAt: nextAct ? activityDueAt(nextAct) : null,
        nextActivitySubject: nextAct?.subject ?? null,
        addTime: toDate(d.add_time),
        updateTime: toDate(d.update_time),
        syncedAt,
      };
    });

    if (dealRows.length > 0) {
      // grava em lotes para não estourar o limite de parâmetros do Postgres
      const CHUNK = 200;
      for (let i = 0; i < dealRows.length; i += CHUNK) {
        await db
          .insert(pipelineDeals)
          .values(dealRows.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: pipelineDeals.pipedriveId,
            set: {
              title: sql`excluded.title`,
              orgId: sql`excluded.org_id`,
              orgName: sql`excluded.org_name`,
              personId: sql`excluded.person_id`,
              personName: sql`excluded.person_name`,
              ownerId: sql`excluded.owner_id`,
              ownerName: sql`excluded.owner_name`,
              value: sql`excluded.value`,
              currency: sql`excluded.currency`,
              pipelineId: sql`excluded.pipeline_id`,
              pipelineName: sql`excluded.pipeline_name`,
              stageId: sql`excluded.stage_id`,
              stageName: sql`excluded.stage_name`,
              stageOrder: sql`excluded.stage_order`,
              status: sql`excluded.status`,
              expectedCloseDate: sql`excluded.expected_close_date`,
              lastActivityAt: sql`excluded.last_activity_at`,
              nextActivityAt: sql`excluded.next_activity_at`,
              nextActivitySubject: sql`excluded.next_activity_subject`,
              addTime: sql`excluded.add_time`,
              updateTime: sql`excluded.update_time`,
              syncedAt: sql`excluded.synced_at`,
            },
          });
      }
    }

    // remove negócios que sumiram/foram excluídos no Pipedrive
    const keptIds = liveDeals.map((d) => d.id);
    if (keptIds.length > 0) {
      await db.execute(
        sql`delete from ${pipelineDeals} where pipedrive_id is not null and pipedrive_id not in ${keptIds}`
      );
    } else {
      await db.delete(pipelineDeals);
    }

    // ── Atividades ────────────────────────────────────────────────────────
    const localDeals = await db
      .select({ id: pipelineDeals.id, pipedriveId: pipelineDeals.pipedriveId })
      .from(pipelineDeals);
    const localIdByPd = new Map(
      localDeals
        .filter((d) => d.pipedriveId != null)
        .map((d) => [d.pipedriveId as number, d.id])
    );

    const actRows = acts
      .filter((a) => !a.is_deleted)
      .map((a) => ({
        pipedriveId: a.id,
        dealPipedriveId: a.deal_id ?? null,
        dealId: a.deal_id ? (localIdByPd.get(a.deal_id) ?? null) : null,
        subject: a.subject || "(sem assunto)",
        type: a.type ?? null,
        ownerName: a.owner_id ? (userName.get(a.owner_id) ?? null) : null,
        dueAt: activityDueAt(a),
        done: Boolean(a.done),
        syncedAt,
      }));

    await db.delete(activities);
    if (actRows.length > 0) {
      const CHUNK = 300;
      for (let i = 0; i < actRows.length; i += CHUNK) {
        await db.insert(activities).values(actRows.slice(i, i + CHUNK));
      }
    }

    const message = `${dealRows.length} negócios e ${actRows.length} atividades sincronizados.`;
    await recordStatus(
      "connected",
      {
        lastError: null,
        deals: dealRows.length,
        activities: actRows.length,
        pipelines: pipelines.length,
      },
      syncedAt
    );

    return {
      ok: true,
      deals: dealRows.length,
      activities: actRows.length,
      message,
      syncedAt,
    };
  } catch (e) {
    const message =
      e instanceof PipedriveError
        ? e.message
        : `Falha na sincronização: ${e instanceof Error ? e.message : "erro desconhecido"}`;
    await recordStatus("error", { lastError: message });
    return { ok: false, deals: 0, activities: 0, message, syncedAt };
  }
}
