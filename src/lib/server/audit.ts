import "server-only";
import { sql } from "./db";

export async function audit(uid: string | null, action: string, meta: Record<string, string | number | boolean | null> = {}) {
  try {
    await sql()`insert into audit_logs (user_id, action, meta) values (${uid}, ${action}, ${sql().json(meta)})`;
  } catch (e) {
    console.error("[audit] failed", action, e);
  }
}
