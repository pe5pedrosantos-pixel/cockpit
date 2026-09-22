"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliverableItems, deliverables, goals } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { currentMonthRef, todayISO } from "@/lib/format";
import { detectLink, PLATFORMS, platformLabel } from "@/lib/platforms";

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/entregas");
  revalidatePath("/empresas/[slug]", "page");
  revalidatePath("/calendario");
}

/**
 * Data de um item quando ela não é informada: hoje, se for do mês corrente;
 * senão o primeiro dia do mês — assim um lançamento retroativo nunca cai
 * na semana atual e não infla as metas semanais.
 */
function defaultDate(monthRef: string): string {
  return monthRef === currentMonthRef() ? todayISO() : `${monthRef}-01`;
}

async function linkCount(deliverableId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deliverableItems)
    .where(eq(deliverableItems.deliverableId, deliverableId));
  return row?.n ?? 0;
}

/**
 * Atualiza a quantidade entregue depois de adicionar ou remover links.
 *
 * Links documentam entregas, mas a contagem manual (+1 no card) continua
 * valendo: se a Grid Co já tinha 4 artes marcadas e você anexa os 4 links,
 * o total segue 4 — não vira 8, e anexar 1 link não derruba para 1.
 *   - "documented" (colar em lote): entregue = maior entre o atual e os links
 *   - "new" (registrar uma entrega no card): é uma peça nova, soma 1
 *   - "removed": só reduz se a contagem vinha inteiramente dos links
 */
async function recountDeliverable(
  deliverableId: number,
  mode: "documented" | "new" | "removed" = "documented"
) {
  const [d] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, deliverableId));
  if (!d) return;

  const links = await linkCount(deliverableId);
  const deliveredQty =
    mode === "new"
      ? Math.max(d.deliveredQty + 1, links)
      : mode === "documented"
        ? Math.max(d.deliveredQty, links)
        : d.deliveredQty <= links + 1
          ? links
          : d.deliveredQty;

  const status =
    deliveredQty >= d.plannedQty
      ? "CONCLUIDO"
      : deliveredQty > 0 && d.status === "PLANEJADO"
        ? "EM_ANDAMENTO"
        : d.status === "CONCLUIDO"
          ? "EM_ANDAMENTO"
          : d.status;

  await db
    .update(deliverables)
    .set({ deliveredQty, status, updatedAt: new Date() })
    .where(eq(deliverables.id, deliverableId));
}

// ─── Um link ──────────────────────────────────────────────────────────────

const addSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  deliverableId: z.coerce.number().int().positive().nullable().optional(),
  monthRef: z.string().regex(/^\d{4}-\d{2}$/),
  url: z.string().optional().nullable(),
  /** obrigatório quando não há link */
  platform: z.string().optional().nullable(),
  format: z.string().max(30).nullable().optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
});

export async function addItem(formData: FormData): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  const raw = Object.fromEntries(formData.entries());
  const parsed = addSchema.safeParse({
    ...raw,
    deliverableId: raw.deliverableId ? Number(raw.deliverableId) : null,
    format: raw.format || null,
    publishedAt: raw.publishedAt || null,
    title: raw.title || null,
  });
  if (!parsed.success) return { ok: false, message: "Confira os dados da publicação." };

  // com link, a rede e o formato saem dele; sem link, a rede vem do formulário
  const link = parsed.data.url ? detectLink(parsed.data.url) : null;
  if (link && !link.valid) {
    return { ok: false, message: "Esse endereço não parece um link válido." };
  }
  const platform = link?.platform ?? parsed.data.platform ?? null;
  if (!platform || !(platform in PLATFORMS)) {
    return { ok: false, message: "Escolha a rede da publicação." };
  }

  await db.insert(deliverableItems).values({
    companyId: parsed.data.companyId,
    deliverableId: parsed.data.deliverableId ?? null,
    monthRef: parsed.data.monthRef,
    url: link?.url ?? null,
    platform,
    format: parsed.data.format ?? link?.format ?? null,
    title: parsed.data.title ?? null,
    publishedAt: parsed.data.publishedAt ?? defaultDate(parsed.data.monthRef),
  });
  if (parsed.data.deliverableId)
    await recountDeliverable(parsed.data.deliverableId, "new");

  revalidateAll();
  return { ok: true, message: `Publicação no ${platformLabel(platform)} registrada.` };
}

// ─── Vários links de uma vez ──────────────────────────────────────────────

const importSchema = z.object({
  companyId: z.number().int().positive(),
  monthRef: z.string().regex(/^\d{4}-\d{2}$/),
  /** "auto" cria um entregável por rede; senão, o id do entregável destino */
  target: z.union([z.literal("auto"), z.literal("none"), z.number().int().positive()]),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  links: z
    .array(
      z.object({
        url: z.string().url(),
        platform: z.enum(Object.keys(PLATFORMS) as [string, ...string[]]),
        format: z.string().nullable(),
      })
    )
    .min(1)
    .max(300),
});

export async function importItems(
  input: z.infer<typeof importSchema>
): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Não há links válidos para salvar." };
  const { companyId, monthRef, target, links } = parsed.data;
  const date = parsed.data.publishedAt ?? defaultDate(monthRef);

  // não duplica um link que já foi registrado para essa empresa
  const existing = await db
    .select({ url: deliverableItems.url })
    .from(deliverableItems)
    .where(eq(deliverableItems.companyId, companyId));
  const known = new Set(existing.map((e) => e.url));
  const fresh = links.filter((l) => !known.has(l.url));
  const skipped = links.length - fresh.length;
  if (fresh.length === 0) {
    return { ok: false, message: "Todos esses links já estavam registrados." };
  }

  const touched = new Set<number>();

  if (target === "none") {
    // só o registro da publicação: conta para as metas, sem mexer no plano
    await db.insert(deliverableItems).values(
      fresh.map((l) => ({
        companyId,
        deliverableId: null,
        monthRef,
        url: l.url,
        platform: l.platform,
        format: l.format,
        publishedAt: date,
      }))
    );
  } else if (target !== "auto") {
    await db.insert(deliverableItems).values(
      fresh.map((l) => ({
        companyId,
        deliverableId: target,
        monthRef,
        url: l.url,
        platform: l.platform,
        format: l.format,
        publishedAt: date,
      }))
    );
    touched.add(target);
  } else {
    // um entregável por rede no mês — reaproveita se já existir
    const byPlatform = new Map<string, typeof fresh>();
    for (const l of fresh) {
      const arr = byPlatform.get(l.platform) ?? [];
      arr.push(l);
      byPlatform.set(l.platform, arr);
    }

    for (const [platform, group] of byPlatform) {
      const [found] = await db
        .select()
        .from(deliverables)
        .where(
          and(
            eq(deliverables.companyId, companyId),
            eq(deliverables.monthRef, monthRef),
            eq(deliverables.platform, platform)
          )
        );

      let deliverableId = found?.id;
      if (!deliverableId) {
        const [created] = await db
          .insert(deliverables)
          .values({
            companyId,
            title: `Posts no ${platformLabel(platform)}`,
            monthRef,
            platform,
            // sem plano prévio, o registrado é o próprio histórico
            plannedQty: group.length,
            deliveredQty: 0,
            status: "EM_ANDAMENTO",
          })
          .returning({ id: deliverables.id });
        deliverableId = created.id;
      }

      await db.insert(deliverableItems).values(
        group.map((l) => ({
          companyId,
          deliverableId,
          monthRef,
          url: l.url,
          platform: l.platform,
          format: l.format,
          publishedAt: date,
        }))
      );
      touched.add(deliverableId);
    }
  }

  for (const id of touched) await recountDeliverable(id);
  revalidateAll();

  return {
    ok: true,
    message:
      `${fresh.length} ${fresh.length === 1 ? "link registrado" : "links registrados"}` +
      (skipped > 0 ? ` (${skipped} já existia${skipped > 1 ? "m" : ""} e foi ignorado${skipped > 1 ? "s" : ""})` : "") +
      ".",
  };
}

export async function deleteItem(id: number) {
  await requireAuth();
  const [item] = await db
    .select()
    .from(deliverableItems)
    .where(eq(deliverableItems.id, id));
  if (!item) return;
  await db.delete(deliverableItems).where(eq(deliverableItems.id, id));
  if (item.deliverableId) await recountDeliverable(item.deliverableId, "removed");
  revalidateAll();
}

const editSchema = z.object({
  title: z.string().trim().max(300).optional().nullable(),
  url: z.string().trim().url("Link inválido").optional().nullable().or(z.literal("")),
  platform: z.enum(Object.keys(PLATFORMS) as [string, ...string[]]),
  format: z.string().optional().nullable(),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data")
    .optional()
    .nullable(),
});

/** Corrige nome, link, rede, formato ou data de uma publicação. */
export async function updateItem(
  id: number,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  const raw = Object.fromEntries(formData.entries());
  const parsed = editSchema.safeParse({
    ...raw,
    title: raw.title || null,
    url: raw.url || null,
    format: raw.format || null,
    publishedAt: raw.publishedAt || null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const [item] = await db.select().from(deliverableItems).where(eq(deliverableItems.id, id));
  if (!item) return { ok: false, message: "Publicação não encontrada." };

  const d = parsed.data;
  await db
    .update(deliverableItems)
    .set({
      title: d.title ?? null,
      url: d.url || null,
      platform: d.platform,
      format: d.format ?? null,
      publishedAt: d.publishedAt ?? null,
      // solta (sem entrega do plano), a publicação acompanha o mês da data
      ...(!item.deliverableId && d.publishedAt
        ? { monthRef: d.publishedAt.slice(0, 7) }
        : {}),
    })
    .where(eq(deliverableItems.id, id));
  revalidateAll();
  return { ok: true, message: "Publicação atualizada." };
}

// ─── Metas ────────────────────────────────────────────────────────────────

const goalSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(120),
  platform: z.enum(Object.keys(PLATFORMS) as [string, ...string[]]),
  format: z.string().max(30).nullable().optional(),
  targetQty: z.coerce.number().int().min(1).max(500),
  period: z.enum(["week", "month"]),
});

export async function saveGoal(formData: FormData, id?: number) {
  await requireAuth();
  const raw = Object.fromEntries(formData.entries());
  const data = goalSchema.parse({ ...raw, format: raw.format || null });
  if (id) await db.update(goals).set(data).where(eq(goals.id, id));
  else await db.insert(goals).values(data);
  revalidateAll();
}

export async function deleteGoal(id: number) {
  await requireAuth();
  await db.update(goals).set({ isActive: false }).where(eq(goals.id, id));
  revalidateAll();
}
