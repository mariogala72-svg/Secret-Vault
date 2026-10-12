import "server-only";
import postgres from "postgres";

declare global {
  var __svSql: postgres.Sql | undefined;
}

/**
 * Single connection pool per server instance. Works with the Supabase pooler
 * (transaction mode, port 6543): prepared statements must be disabled there.
 */
export function sql(): postgres.Sql {
  if (globalThis.__svSql) return globalThis.__svSql;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL non configurata");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  globalThis.__svSql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ssl: local ? false : "require",
    transform: { undefined: null },
  });
  return globalThis.__svSql;
}

export type Row = postgres.Row;
