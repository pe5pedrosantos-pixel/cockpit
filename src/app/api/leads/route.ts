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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret, apikey",
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
    name: z.string({ error: "Informe seu nome" }).trim().min(2, "Informe seu nome").max(120),
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
  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData().catch(() => null);
    return form ? Object.fromEntries(form.entries()) : {};
  }
  // JSON, inclusive quando vem sem content-type ou como text/plain
  const text = await req.text().catch(() => "");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
}

/** "Nome Completo", "full_name", "fullName" → "nomecompleto", "fullname". */
const keyOf = (k: string) =>
  k
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Achata o corpo: aceita os campos na raiz ou dentro de data/lead/fields/
 * payload/record/body/formData/values/contact (formatos comuns de webhook).
 */
function flatten(raw: Record<string, unknown>, out: Record<string, string> = {}, depth = 0) {
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    if (typeof v === "object" && !Array.isArray(v) && depth < 3) {
      flatten(v as Record<string, unknown>, out, depth + 1);
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      const key = keyOf(k);
      const val = String(v).trim();
      if (val && !(key in out)) out[key] = val;
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      const key = keyOf(k);
      if (v.length && !(key in out)) out[key] = v.join(", ");
    }
  }
  return out;
}

/** Aceita nomes de campo comuns em português e inglês, em qualquer grafia. */
function normalizeKeys(raw: Record<string, unknown>) {
  const f = flatten(raw);
  const pick = (...keys: string[]) => {
    for (const k of keys) if (f[k]) return f[k];
    return null;
  };
  const first = pick("firstname", "primeironome");
  const last = pick("lastname", "sobrenome");
  return {
    name:
      pick("name", "nome", "fullname", "nomecompleto", "seunome", "yourname", "contactname", "nomecontato") ??
      ([first, last].filter(Boolean).join(" ") || null),
    email: pick("email", "mail", "emailaddress", "seuemail", "enderecoemail", "emailcorporativo"),
    phone: pick(
      "phone", "telefone", "whatsapp", "celular", "tel", "telephone", "mobile", "phonenumber",
      "numerowhatsapp", "whatsappnumber", "fone"
    ),
    company: pick("company", "empresa", "organization", "organizacao", "companyname", "nomeempresa", "instituicao"),
    role: pick("role", "cargo", "jobtitle", "position", "funcao"),
    interest: pick(
      "interest", "interesse", "servico", "service", "tipo", "type", "assunto", "subject",
      "tipoevento", "eventtype", "solucao", "produto"
    ),
    message: pick("message", "mensagem", "descricao", "description", "msg", "comments", "comentarios", "detalhes", "details", "observacoes"),
    utm_source: pick("utmsource"),
    utm_campaign: pick("utmcampaign"),
    page_url: pick("pageurl", "pagina", "url", "page", "origem", "source", "landingpage", "referrer"),
    website: pick("website", "gotcha", "honeypot"),
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
  const raw = await readBody(req);
  const fields = normalizeKeys(raw);
  // e-mail mal digitado não derruba o lead se houver telefone
  if (fields.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email) && fields.phone) fields.email = null;
  const parsed = schema.safeParse(fields);
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? "Dados inválidos";
    // só os nomes dos campos, nunca os valores, para diagnosticar integrações
    console.warn("[leads] envio recusado:", error, "| campos recebidos:", Object.keys(flatten(raw)).join(", ") || "(nenhum)", "| content-type:", req.headers.get("content-type"));
    return json({ ok: false, error }, 400);
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
