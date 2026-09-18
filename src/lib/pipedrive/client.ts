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

export function getPipedriveConfig(): PipedriveConfig | null {
  const token = process.env.PIPEDRIVE_API_TOKEN?.trim();
  const domain = process.env.PIPEDRIVE_COMPANY_DOMAIN?.trim();
  if (!token || !domain) return null;
  // aceita tanto "sobe" quanto "sobe.pipedrive.com" ou a URL completa
  const clean = domain
    .replace(/^https?:\/\//, "")
    .replace(/\.pipedrive\.com.*$/, "")
    .replace(/\/.*$/, "");
  if (!clean) return null;
  return { token, domain: clean };
}

export function isPipedriveConfigured(): boolean {
  return getPipedriveConfig() !== null;
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
  const url = new URL(`${baseUrl(config, API_VERSION)}/${path}`);
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
      detail = body?.error ? ` — ${body.error}` : "";
    } catch {
      /* corpo não-JSON */
    }
    throw new PipedriveError(
      `Pipedrive respondeu ${res.status}${detail}`,
      res.status
    );
  }

  return (await res.json()) as PipedriveResponse<T>;
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
  add_time?: string | null;
  update_time?: string | null;
  next_activity_id?: number | null;
  last_activity_id?: number | null;
  is_deleted?: boolean;
}

export interface PdPerson {
  id: number;
  name?: string | null;
}

export interface PdOrganization {
  id: number;
  name?: string | null;
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
  owner_id?: number | null;
  due_date?: string | null;
  due_time?: string | null;
  done?: boolean;
  is_deleted?: boolean;
}

// ─── Endpoints ────────────────────────────────────────────────────────────

export const pipedrive = {
  pipelines: (c: PipedriveConfig) => fetchAll<PdPipeline>(c, "pipelines"),

  stages: (c: PipedriveConfig) => fetchAll<PdStage>(c, "stages"),

  deals: (c: PipedriveConfig) =>
    fetchAll<PdDeal>(c, "deals", {
      // os campos de atividade saíram do objeto padrão na v2
      include_fields: "next_activity_id,last_activity_id",
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
    const url = `${baseUrl(c, "v1")}/users`;
    try {
      const res = await fetch(url, {
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
};
