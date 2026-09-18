"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";

const taskSchema = z.object({
  title: z.string().min(1, "Informe o título").max(200),
  description: z.string().max(2000).optional().nullable(),
  companyId: z.coerce.number().int().positive().nullable().optional(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]),
  status: z.enum(["A_FAZER", "EM_ANDAMENTO", "CONCLUIDA"]),
});

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return taskSchema.parse({
    ...raw,
    companyId: raw.companyId ? Number(raw.companyId) : null,
    dueDate: raw.dueDate ? String(raw.dueDate) : null,
    description: raw.description || null,
  });
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/tarefas");
  revalidatePath("/empresas/[slug]", "page");
  revalidatePath("/calendario");
}

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

export async function createTask(formData: FormData) {
  await requireAuth();
  const data = parseForm(formData);
  await db.insert(tasks).values({
    ...data,
    completedAt: data.status === "CONCLUIDA" ? new Date() : null,
  });
  revalidateAll();
}

export async function updateTask(id: number, formData: FormData) {
  await requireAuth();
  const data = parseForm(formData);
  await db
    .update(tasks)
    .set({
      ...data,
      completedAt: data.status === "CONCLUIDA" ? new Date() : null,
    })
    .where(eq(tasks.id, id));
  revalidateAll();
}

export async function deleteTask(id: number) {
  await requireAuth();
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidateAll();
}

export async function toggleTask(id: number, done: boolean) {
  await requireAuth();
  await db
    .update(tasks)
    .set({
      status: done ? "CONCLUIDA" : "A_FAZER",
      completedAt: done ? new Date() : null,
    })
    .where(eq(tasks.id, id));
  revalidateAll();
}

export async function setTaskStatus(
  id: number,
  status: "A_FAZER" | "EM_ANDAMENTO" | "CONCLUIDA"
) {
  await requireAuth();
  await db
    .update(tasks)
    .set({
      status,
      completedAt: status === "CONCLUIDA" ? new Date() : null,
    })
    .where(eq(tasks.id, id));
  revalidateAll();
}
