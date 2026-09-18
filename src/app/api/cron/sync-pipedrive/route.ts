import { NextRequest, NextResponse } from "next/server";
import { syncPipedrive } from "@/lib/pipedrive/sync";
import { isPipedriveConfigured } from "@/lib/pipedrive/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronização automática, disparada pelo cron da Vercel.
 *
 * A Vercel envia o header `Authorization: Bearer $CRON_SECRET` quando a
 * variável CRON_SECRET existe. Fora isso, a rota é recusada — ela não pode
 * ficar aberta na internet.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "CRON_SECRET não configurado." },
      { status: 503 }
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!isPipedriveConfigured()) {
    return NextResponse.json({
      ok: false,
      message: "Pipedrive não configurado — sincronização ignorada.",
    });
  }

  const result = await syncPipedrive();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
