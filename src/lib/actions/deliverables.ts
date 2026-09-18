"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliverables } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";

const deliverableSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().min(1, "Informe o nome da entrega").max(200),
  description: z.string().max(2000).optional().nullable(),
  monthRef: z.string().regex(/^\d{4}-\d{2}$/),
  plannedQty: z.coerce.number().int().min(1),
  deliveredQty: z.coerce.number().int().min(0),
  deadline: z.string().optional().nullable(),
  status: z.enum(["PLANEJADO", "EM_ANDAMENTO", "CONCLUIDO", "ATRASADO"]),
  owner: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return deliverableSchema.parse({
    ...raw,
    categoryId: raw.categoryId ? Number(raw.categoryId) : null,
    deadline: raw.deadline ? String(raw.deadline) : null,
    description: raw.description || null,
    owner: raw.owner || null,
    notes: raw.notes || null,
  });
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/entregas");
  revalidatePath("/empresas/[slug]", "page");
  revalidatePath("/calendario");
}

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

export async function createDeliverable(formData: FormData) {
  await requireAuth();
  const data = parseForm(formData);
  // se entregue >= planejado, marca concluído automaticamente
  const status =
    data.deliveredQty >= data.plannedQty ? "CONCLUIDO" : data.status;
  await db.insert(deliverables).values({ ...data, status });
  revalidateAll();
}

export async function updateDeliverable(id: number, formData: FormData) {
  await requireAuth();
  const data = parseForm(formData);
  const status =
    data.deliveredQty >= data.plannedQty ? "CONCLUIDO" : data.status;
  await db
    .update(deliverables)
    .set({ ...data, status, updatedAt: new Date() })
    .where(eq(deliverables.id, id));
  revalidateAll();
}

export async function deleteDeliverable(id: number) {
  await requireAuth();
  await db.delete(deliverables).where(eq(deliverables.id, id));
  revalidateAll();
}

/** +1 / -1 na quantidade entregue (uso rápido no Kanban). */
export async function incrementDelivered(id: number, delta: number) {
  await requireAuth();
  const [item] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, id));
  if (!item) return;

  const deliveredQty = Math.min(
    Math.max(item.deliveredQty + delta, 0),
    item.plannedQty
  );
  let status = item.status;
  if (deliveredQty >= item.plannedQty) status = "CONCLUIDO";
  else if (status === "CONCLUIDO") status = "EM_ANDAMENTO";
  else if (status === "PLANEJADO" && deliveredQty > 0) status = "EM_ANDAMENTO";

  await db
    .update(deliverables)
    .set({ deliveredQty, status, updatedAt: new Date() })
    .where(eq(deliverables.id, id));
  revalidateAll();
}

export async function setDeliverableStatus(
  id: number,
  status: "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "ATRASADO"
) {
  await requireAuth();
  const [item] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, id));
  if (!item) return;
  const patch: Partial<typeof deliverables.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  if (status === "CONCLUIDO") patch.deliveredQty = item.plannedQty;
  await db.update(deliverables).set(patch).where(eq(deliverables.id, id));
  revalidateAll();
}
