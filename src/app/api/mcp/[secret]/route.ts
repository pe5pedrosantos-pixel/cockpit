import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleRpc } from "@/lib/social/mcp";

/**
 * Conector MCP do cockpit para o Claude (claude.ai → Configurações →
 * Conectores → Adicionar conector personalizado).
 *
 * O claude.ai não manda cabeçalho de autenticação próprio para conectores
 * sem OAuth, então o segredo vai no caminho: /api/mcp/<MCP_SECRET>.
 * Quem não tem o endereço completo recebe 404, como se a rota não existisse.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validSecret(given: string) {
  const expected = process.env.MCP_SECRET;
  if (!expected || expected.length < 24) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function POST(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!validSecret(secret)) return notFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const m of messages) {
    const r = await handleRpc(m as Parameters<typeof handleRpc>[0]);
    if (r) responses.push(r);
  }
  // só notificações (ex.: notifications/initialized): aceito, sem corpo
  if (!responses.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0], {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Sem fluxo SSE: o servidor só responde a POST. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!validSecret(secret)) return notFound();
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!validSecret(secret)) return notFound();
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
