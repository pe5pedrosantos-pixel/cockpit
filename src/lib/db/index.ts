import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * O pooler do Supabase tem dois modos na mesma máquina:
 * - 6543, "transaction": cada consulta pode cair numa conexão diferente.
 *   Com várias telas carregando ao mesmo tempo, o postgres.js enfileira
 *   consultas na mesma conexão (pipelining) e o pooler se perde — a
 *   instância inteira trava até o limite de tempo.
 * - 5432, "session": a conexão é nossa enquanto estiver aberta. Aguenta o
 *   pipelining sem problema.
 * Usamos o modo sessão a partir da mesma DATABASE_URL, sem mexer na Vercel.
 * DB_POOL_MODE=transaction volta ao comportamento antigo, se precisar.
 */
function connectionUrl(raw: string): string {
  if (process.env.DB_POOL_MODE === "transaction") return raw;
  return raw.includes("pooler.supabase.com:6543")
    ? raw.replace("pooler.supabase.com:6543", "pooler.supabase.com:5432")
    : raw;
}

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(connectionUrl(process.env.DATABASE_URL!), {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    // conexões não vivem para sempre: evita herdar uma conexão ruim
    max_lifetime: 60 * 5,
    prepare: false,
  });

// reaproveita a conexão entre invocações (evita handshake a cada request)
globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
