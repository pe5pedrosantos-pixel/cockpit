import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL!, {
    // em serverless cada instância mantém poucas conexões; o pooler do
    // Supabase cuida da multiplexação
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    // o pooler em modo transação não suporta prepared statements
    prepare: false,
  });

// reaproveita a conexão entre invocações (evita handshake a cada request)
globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
