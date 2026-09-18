"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { syncPipedrive, type SyncResult } from "@/lib/pipedrive/sync";

export async function syncPipedriveAction(): Promise<SyncResult> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");

  const result = await syncPipedrive();

  revalidatePath("/");
  revalidatePath("/funil");
  revalidatePath("/integracoes");

  return result;
}
