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
const rawUrl = process.env.DATABASE_URL!;
const useSession =
  process.env.DB_POOL_MODE !== "transaction" &&
  rawUrl.includes("pooler.supabase.com:6543");
const url = useSession
  ? rawUrl.replace("pooler.supabase.com:6543", "pooler.supabase.com:5432")
  : rawUrl;

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(url, {
    // No modo sessão o plano grátis aceita 15 clientes no total. Uma
    // conexão por instância basta: as consultas simultâneas seguem em
    // pipeline nela, e várias instâncias não esgotam o limite.
    max: useSession ? 1 : 3,
    idle_timeout: useSession ? 10 : 20,
    connect_timeout: 10,
    // conexões não vivem para sempre: evita herdar uma conexão ruim
    max_lifetime: 60 * 5,
    prepare: false,
  });

// reaproveita a conexão entre invocações (evita handshake a cada request)
globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
