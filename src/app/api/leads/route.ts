import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leadNotes, leads } from "@/lib/db/schema";
import { normalizeInterest } from "@/lib/leads";

/**
 * Entrada pública de leads do site de Pedro Santos.
 *
 * O formulário da landing page faz POST aqui (JSON ou form) e o lead cai
 * no funil "Pedro Santos" do cockpit, na etapa "Novo lead".
 *
 * Proteções: campo-isca (honeypot), limites de tamanho, deduplicação por
 * e-mail/telefone na última hora e um teto de envios por janela de tempo.
 */

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const str = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const schema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome").max(120),
    email: str(160).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido"),
    phone: str(40),
    company: str(160),
    role: str(120),
    interest: str(80),
    message: str(4000),
    utm_source: str(120),
    utm_campaign: str(120),
    page_url: str(500),
    // honeypot: humanos não veem esse campo; robôs costumam preencher
    website: str(200),
  })
  .refine((d) => d.email || d.phone, {
    message: "Informe e-mail ou telefone",
    path: ["email"],
  });

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const form = await req.formData().catch(() => null);
  return form ? Object.fromEntries(form.entries()) : {};
}

/** Aceita nomes de campo comuns em português também. */
function normalizeKeys(raw: Record<string, unknown>) {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  };
  return {
    name: pick("name", "nome"),
    email: pick("email", "e-mail"),
    phone: pick("phone", "telefone", "whatsapp", "celular"),
    company: pick("company", "empresa", "organization", "organizacao"),
    role: pick("role", "cargo"),
    interest: pick("interest", "interesse", "servico", "tipo"),
    message: pick("message", "mensagem", "descricao"),
    utm_source: pick("utm_source"),
    utm_campaign: pick("utm_campaign"),
    page_url: pick("page_url", "pagina"),
    website: pick("website", "_gotcha"),
  };
}

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e) {
    console.error("[leads] falha ao registrar lead:", e);
    return json({ ok: false, error: "Não foi possível enviar agora. Tente de novo em instantes." }, 500);
  }
}

async function handle(req: NextRequest) {
  const parsed = schema.safeParse(normalizeKeys(await readBody(req)));
  if (!parsed.success) {
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, 400);
  }
  const d = parsed.data;

  // robô: responde "ok" para não ensinar o que foi bloqueado
  if (d.website) return json({ ok: true });

  // teto de envios: protege o funil de enxurrada de spam
  const tenMinAgo = new Date(Date.now() - 10 * 60_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.source, "site"), gte(leads.createdAt, tenMinAgo)));
  if (n >= 30) return json({ ok: false, error: "Muitos envios. Tente em alguns minutos." }, 429);

  const message = [d.message, d.role ? `Cargo: ${d.role}` : null].filter(Boolean).join("\n");

  // mesmo contato mandou de novo na última hora → vira nota, não lead duplicado
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const conds = [];
  if (d.email) conds.push(eq(leads.email, d.email.toLowerCase()));
  if (d.phone) conds.push(eq(leads.phone, d.phone));
  const [dup] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(gte(leads.createdAt, hourAgo), or(...conds)))
    .limit(1);
  if (dup) {
    if (message) {
      await db.insert(leadNotes).values({ leadId: dup.id, content: `Novo envio pelo site:\n${message}` });
    }
    await db.update(leads).set({ seen: false, updatedAt: new Date() }).where(eq(leads.id, dup.id));
    return json({ ok: true });
  }

  await db.insert(leads).values({
    name: d.name,
    email: d.email?.toLowerCase() ?? null,
    phone: d.phone,
    organization: d.company,
    role: d.role,
    interest: normalizeInterest(d.interest) ?? d.interest,
    message: d.message,
    source: "site",
    stage: "novo",
    utmSource: d.utm_source,
    utmCampaign: d.utm_campaign,
    pageUrl: d.page_url,
    seen: false,
  });

  return json({ ok: true });
}
