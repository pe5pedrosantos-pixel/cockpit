"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, companies } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const companySchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().max(500).optional().nullable(),
  hasDeliverables: z.boolean(),
  isActive: z.boolean(),
});

export async function createCompany(formData: FormData) {
  await requireAuth();
  const data = companySchema.parse({
    name: formData.get("name"),
    color: formData.get("color") || "#6366f1",
    description: formData.get("description") || null,
    hasDeliverables: formData.get("hasDeliverables") === "on",
    isActive: true,
  });
  await db.insert(companies).values({ ...data, slug: slugify(data.name) });
  revalidatePath("/", "layout");
}

export async function updateCompany(id: number, formData: FormData) {
  await requireAuth();
  const data = companySchema.parse({
    name: formData.get("name"),
    color: formData.get("color") || "#6366f1",
    description: formData.get("description") || null,
    hasDeliverables: formData.get("hasDeliverables") === "on",
    isActive: formData.get("isActive") === "on",
  });
  await db.update(companies).set(data).where(eq(companies.id, id));
  revalidatePath("/", "layout");
}

export async function createCategory(formData: FormData) {
  await requireAuth();
  const name = z.string().min(1).max(80).parse(formData.get("name"));
  await db.insert(categories).values({ name }).onConflictDoNothing();
  revalidatePath("/cadastros");
}

export async function deleteCategory(id: number) {
  await requireAuth();
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/cadastros");
}
