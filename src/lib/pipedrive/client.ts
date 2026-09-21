/**
 * Cliente da API do Pipedrive (v2).
 *
 * A API v1 foi descontinuada em 2026, então usamos exclusivamente a v2:
 *  - Base: https://{dominio}.pipedrive.com/api/v2
 *  - Autenticação: header `x-api-token`
 *  - Paginação: cursor (`cursor` + `limit`, máx. 500), `additional_data.next_cursor`
 *
 * Este módulo é SOMENTE servidor — o token nunca chega ao navegador.
 */

import "server-only";

const API_VERSION = "v2";
const MAX_LIMIT = 500;
/** Trava de segurança para não entrar em loop infinito de paginação. */
const MAX_PAGES = 40;

export interface PipedriveConfig {
  token: string;
  domain: string;
}

export class PipedriveError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "PipedriveError";
  }
}

/** Normaliza "sobe", "sobe.pipedrive.com" ou a URL completa para "sobe". */
function cleanDomain(raw?: string | null): string {
  return (raw ?? "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\.pipedrive\.com.*$/, "")
    .replace(/\/.*$/, "");
}

export function getPipedriveConfig(): PipedriveConfig | null {
  const token = process.env.PIPEDRIVE_API_TOKEN?.trim();
  if (!token) return null;
  // o domínio é opcional: se não vier, descobrimos a partir do token
  return { token, domain: cleanDomain(process.env.PIPEDRIVE_COMPANY_DOMAIN) };
}

export function isPipedriveConfigured(): boolean {
  return getPipedriveConfig() !== null;
}

/**
 * Descobre o domínio da empresa a partir do próprio token.
 *
 * `api.pipedrive.com/v1/users/me` responde sem exigir o domínio e devolve
 * `company_domain` — então a configuração não depende de acertar esse valor
 * na mão, e um domínio errado no ambiente deixa de quebrar a integração.
 */
const domainCache = new Map<string, string>();

export async function resolveCompanyDomain(token: string): Promise<string> {
  const cached = domainCache.get(token);
  if (cached) return cached;

  const override = process.env.PIPEDRIVE_API_BASE_URL?.trim();
  const url = override
    ? `${override.replace(/\/$/, "")}/api/v1/users/me`
    : "https://api.pipedrive.com/v1/users/me";

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-api-token": token, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new PipedriveError("Não foi possível conectar ao Pipedrive.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new PipedriveError(
      "Token do Pipedrive inválido ou sem permissão. Confira PIPEDRIVE_API_TOKEN.",
      res.status
    );
  }

  const body = await readJson<{ data?: { company_domain?: string } }>(res);
  const domain = cleanDomain(body?.data?.company_domain);
  if (!domain) {
    throw new PipedriveError(
      "O Pipedrive não informou o domínio da empresa para este token."
    );
  }

  domainCache.set(token, domain);
  return domain;
}

/**
 * Lê o corpo como JSON. Um domínio errado devolve a página HTML do Pipedrive
 * com status 200 — sem este tratamento, o HTML inteiro viraria a mensagem
 * de erro.
 */
async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PipedriveError(
      "O Pipedrive respondeu com uma página em vez de dados — normalmente isso significa domínio da empresa incorreto.",
      res.status
    );
  }
}

/**
 * URL base da API. PIPEDRIVE_API_BASE_URL existe apenas para apontar os
 * testes a um servidor local; em produção fica vazia.
 */
function baseUrl(config: PipedriveConfig, version: string): string {
  const override = process.env.PIPEDRIVE_API_BASE_URL?.trim();
  const root = override || `https://${config.domain}.pipedrive.com`;
  return `${root.replace(/\/$/, "")}/api/${version}`;
}

interface PipedriveResponse<T> {
  success?: boolean;
  data?: T[] | null;
  additional_data?: { next_cursor?: string | null } | null;
  error?: string;
}

async function request<T>(
  config: PipedriveConfig,
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<PipedriveResponse<T>> {
  // o domínio vem do token quando não foi configurado à mão
  const domain = config.domain || (await resolveCompanyDomain(config.token));
  try {
    return await requestWithDomain<T>(config, domain, path, params);
  } catch (e) {
    // Um domínio configurado errado devolve HTML ou 404. Nesse caso
    // descobrimos o correto pelo token e refazemos a chamada, para que um
    // valor errado no ambiente não derrube a integração.
    const recoverable =
      e instanceof PipedriveError &&
      config.domain &&
      (e.status === 404 || e.message.includes("página em vez de dados"));
    if (!recoverable) throw e;

    const discovered = await resolveCompanyDomain(config.token);
    if (discovered === domain) throw e;
    return await requestWithDomain<T>(config, discovered, path, params);
  }
}

async function requestWithDomain<T>(
  config: PipedriveConfig,
  domain: string,
  path: string,
  params: Record<string, string | number | undefined>
): Promise<PipedriveResponse<T>> {
  const url = new URL(`${baseUrl({ ...config, domain }, API_VERSION)}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "x-api-token": config.token,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    throw new PipedriveError(
      `Não foi possível conectar ao Pipedrive: ${
        e instanceof Error ? e.message : "erro de rede"
      }`
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new PipedriveError(
      "Token do Pipedrive inválido ou sem permissão. Confira PIPEDRIVE_API_TOKEN.",
      res.status
    );
  }
  if (res.status === 404) {
    throw new PipedriveError(
      `Domínio do Pipedrive não encontrado ("${config.domain}"). Confira PIPEDRIVE_COMPANY_DOMAIN.`,
      404
    );
  }
  if (res.status === 429) {
    throw new PipedriveError(
      "Limite de requisições do Pipedrive atingido. Tente novamente em alguns minutos.",
      429
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string };
      detail = body?.error ? ` — ${String(body.error).slice(0, 200)}` : "";
    } catch {
      /* corpo não-JSON */
    }
    throw new PipedriveError(
      `Pipedrive respondeu ${res.status}${detail}`,
      res.status
    );
  }

  return await readJson<PipedriveResponse<T>>(res);
}

/** Busca todas as páginas de um endpoint de coleção (paginação por cursor). */
async function fetchAll<T>(
  config: PipedriveConfig,
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await request<T>(config, path, {
      ...params,
      limit: MAX_LIMIT,
      cursor,
    });
    const rows = body.data ?? [];
    out.push(...rows);

    const next = body.additional_data?.next_cursor;
    if (!next || rows.length === 0) break;
    cursor = next;
  }

  return out;
}

// ─── Tipos (apenas os campos que usamos) ──────────────────────────────────

export interface PdPipeline {
  id: number;
  name: string;
  order_nr?: number;
  is_deleted?: boolean;
}

export interface PdStage {
  id: number;
  name: string;
  order_nr?: number;
  pipeline_id: number;
  is_deleted?: boolean;
}

export interface PdDeal {
  id: number;
  title: string;
  value?: number | null;
  currency?: string | null;
  /** Na v2 estes campos trazem apenas o ID — os nomes resolvemos localmente. */
  person_id?: number | null;
  org_id?: number | null;
  owner_id?: number | null;
  pipeline_id?: number | null;
  stage_id?: number | null;
  status?: string | null;
  expected_close_date?: string | null;
  won_time?: string | null;
  close_time?: string | null;
  add_time?: string | null;
  update_time?: string | null;
  next_activity_id?: number | null;
  last_activity_id?: number | null;
  is_deleted?: boolean;
}

export interface PdPerson {
  id: number;
  name?: string | null;
  org_id?: number | null;
  /** v2: listas de { value, primary, label } */
  emails?: { value?: string; primary?: boolean }[] | null;
  phones?: { value?: string; primary?: boolean }[] | null;
}

export interface PdOrganization {
  id: number;
  name?: string | null;
  owner_id?: number | null;
}

export interface PdActivityType {
  key_string: string;
  name: string;
  active_flag?: boolean;
  order_nr?: number;
}

export interface PdUser {
  id: number;
  name?: string | null;
  email?: string | null;
}

export interface PdActivity {
  id: number;
  subject?: string | null;
  type?: string | null;
  deal_id?: number | null;
  org_id?: number | null;
  owner_id?: number | null;
  due_date?: string | null;
  due_time?: string | null;
  note?: string | null;
  done?: boolean;
  is_deleted?: boolean;
}

/**
 * Escrita no Pipedrive. A v2 cobre negócios, organizações, pessoas e
 * atividades; notas e tipos de atividade seguem só na v1.
 */
async function write<T>(
  config: PipedriveConfig,
  path: string,
  body: Record<string, unknown>,
  opts: { method?: "POST" | "PATCH"; version?: "v1" | "v2" } = {}
): Promise<T> {
  const domain = config.domain || (await resolveCompanyDomain(config.token));
  const url = `${baseUrl({ ...config, domain }, opts.version ?? API_VERSION)}/${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "POST",
      headers: {
        "x-api-token": config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new PipedriveError("Não foi possível conectar ao Pipedrive.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new PipedriveError(
      "O token do Pipedrive não tem permissão para essa alteração.",
      res.status
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const b = (await res.json()) as { error?: string };
      detail = b?.error ? ` — ${String(b.error).slice(0, 200)}` : "";
    } catch {
      /* corpo não-JSON */
    }
    throw new PipedriveError(
      `O Pipedrive recusou a alteração (${res.status})${detail}`,
      res.status
    );
  }

  const body2 = await readJson<{ data?: T }>(res);
  if (!body2?.data) {
    throw new PipedriveError("O Pipedrive não confirmou a alteração.");
  }
  return body2.data;
}

/** Busca por termo (usado para reaproveitar organização/pessoa existente). */
async function search<T extends { id: number; name?: string | null }>(
  config: PipedriveConfig,
  resource: "organizations" | "persons",
  term: string
): Promise<T | null> {
  if (term.trim().length < 2) return null;
  try {
    const domain = config.domain || (await resolveCompanyDomain(config.token));
    const url = new URL(
      `${baseUrl({ ...config, domain }, API_VERSION)}/${resource}/search`
    );
    url.searchParams.set("term", term.trim());
    url.searchParams.set("fields", "name");
    url.searchParams.set("exact_match", "true");
    url.searchParams.set("limit", "1");

    const res = await fetch(url, {
      headers: { "x-api-token": config.token, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: { items?: { item?: T }[] } | null;
    };
    return body.data?.items?.[0]?.item ?? null;
  } catch {
    return null; // busca é otimização; se falhar, criamos um novo
  }
}

// ─── Endpoints ────────────────────────────────────────────────────────────

export const pipedrive = {
  pipelines: (c: PipedriveConfig) => fetchAll<PdPipeline>(c, "pipelines"),

  stages: (c: PipedriveConfig) => fetchAll<PdStage>(c, "stages"),

  deals: (c: PipedriveConfig) =>
    fetchAll<PdDeal>(c, "deals", {
      // os campos de atividade saíram do objeto padrão na v2
      include_fields: "next_activity_id,last_activity_id,first_won_time",
      sort_by: "update_time",
      sort_direction: "desc",
    }),

  persons: (c: PipedriveConfig) => fetchAll<PdPerson>(c, "persons"),

  organizations: (c: PipedriveConfig) =>
    fetchAll<PdOrganization>(c, "organizations"),

  activities: (c: PipedriveConfig) => fetchAll<PdActivity>(c, "activities"),

  /**
   * Usuários ainda não têm equivalente na v2; a v1 segue disponível para
   * este recurso. Se falhar, seguimos sem os nomes dos responsáveis.
   */
  users: async (c: PipedriveConfig): Promise<PdUser[]> => {
    try {
      const domain = c.domain || (await resolveCompanyDomain(c.token));
      const res = await fetch(`${baseUrl({ ...c, domain }, "v1")}/users`, {
        headers: { "x-api-token": c.token, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { data?: PdUser[] | null };
      return body.data ?? [];
    } catch {
      return [];
    }
  },

  /** Chamada leve para validar token e domínio. */
  ping: async (c: PipedriveConfig): Promise<boolean> => {
    await request(c, "pipelines", { limit: 1 });
    return true;
  },

  // ── Escrita ─────────────────────────────────────────────────────────────

  /** Reaproveita a organização com esse nome exato, ou cria uma nova. */
  findOrCreateOrganization: async (
    c: PipedriveConfig,
    name: string
  ): Promise<PdOrganization> => {
    const found = await search<PdOrganization>(c, "organizations", name);
    if (found) return found;
    return write<PdOrganization>(c, "organizations", { name: name.trim() });
  },

  findOrCreatePerson: async (
    c: PipedriveConfig,
    name: string,
    orgId?: number | null
  ): Promise<PdPerson> => {
    const found = await search<PdPerson>(c, "persons", name);
    if (found) return found;
    return write<PdPerson>(c, "persons", {
      name: name.trim(),
      ...(orgId ? { org_id: orgId } : {}),
    });
  },

  createDeal: async (
    c: PipedriveConfig,
    deal: {
      title: string;
      value?: number | null;
      currency?: string;
      person_id?: number | null;
      org_id?: number | null;
      pipeline_id?: number | null;
      stage_id?: number | null;
      expected_close_date?: string | null;
    }
  ): Promise<PdDeal> => {
    const body: Record<string, unknown> = { title: deal.title.trim() };
    if (deal.value != null) body.value = deal.value;
    if (deal.currency) body.currency = deal.currency;
    if (deal.person_id) body.person_id = deal.person_id;
    if (deal.org_id) body.org_id = deal.org_id;
    if (deal.pipeline_id) body.pipeline_id = deal.pipeline_id;
    if (deal.stage_id) body.stage_id = deal.stage_id;
    if (deal.expected_close_date)
      body.expected_close_date = deal.expected_close_date;
    return write<PdDeal>(c, "deals", body);
  },

  /** Tipos de atividade configurados na conta (Ligação, Reunião…). v1. */
  activityTypes: async (c: PipedriveConfig): Promise<PdActivityType[]> => {
    try {
      const domain = c.domain || (await resolveCompanyDomain(c.token));
      const res = await fetch(`${baseUrl({ ...c, domain }, "v1")}/activityTypes`, {
        headers: { "x-api-token": c.token, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { data?: PdActivityType[] | null };
      return (body.data ?? []).filter((t) => t.active_flag !== false);
    } catch {
      return [];
    }
  },

  createActivity: async (
    c: PipedriveConfig,
    a: {
      subject: string;
      type: string;
      deal_id?: number | null;
      org_id?: number | null;
      due_date: string;
      due_time?: string | null;
      note?: string | null;
    }
  ): Promise<PdActivity> => {
    const body: Record<string, unknown> = {
      subject: a.subject.trim(),
      type: a.type,
      due_date: a.due_date,
    };
    if (a.due_time) body.due_time = a.due_time;
    if (a.deal_id) body.deal_id = a.deal_id;
    if (a.org_id) body.org_id = a.org_id;
    if (a.note) body.note = a.note;
    return write<PdActivity>(c, "activities", body);
  },

  setActivityDone: async (
    c: PipedriveConfig,
    activityId: number,
    done: boolean
  ): Promise<PdActivity> =>
    write<PdActivity>(c, `activities/${activityId}`, { done }, { method: "PATCH" }),

  /** Nota no histórico do negócio. Notas só existem na v1. */
  addNote: async (
    c: PipedriveConfig,
    n: { content: string; deal_id?: number | null; org_id?: number | null }
  ): Promise<{ id: number }> => {
    const body: Record<string, unknown> = { content: n.content };
    if (n.deal_id) body.deal_id = n.deal_id;
    else if (n.org_id) body.org_id = n.org_id;
    return write<{ id: number }>(c, "notes", body, { version: "v1" });
  },
};
