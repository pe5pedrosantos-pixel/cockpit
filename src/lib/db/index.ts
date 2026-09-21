import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Conexão com o Supabase pelo pooler em modo transação (porta 6543).
 *
 * Na Vercel as instâncias ficam congeladas entre um acesso e outro. Uma
 * conexão aberta nesse intervalo pode morrer do lado do Supabase sem a
 * instância saber — e a próxima tela fica esperando para sempre. Por isso:
 * - attachDatabasePool avisa a Vercel para fechar as conexões ociosas
 *   antes de congelar a instância;
 * - toda consulta tem prazo (query_timeout): se algo travar, a tela
 *   mostra erro em segundos em vez de ficar carregando;
 * - o driver pg não faz pipelining, que o pooler em modo transação não
 *   suporta bem.
 */
const globalForDb = globalThis as unknown as { pool: Pool | undefined };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
    // o Supabase exige TLS; o certificado do pooler não fecha a cadeia no Node
    ssl: process.env.DATABASE_URL?.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  });

if (!globalForDb.pool) {
  globalForDb.pool = pool;
  // conexão que cai não derruba o processo
  pool.on("error", (err) => console.error("[db] conexão perdida:", err.message));
  attachDatabasePool(pool);
}

export const db = drizzle(pool, { schema });
