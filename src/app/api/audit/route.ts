import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { iso, ok, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const rows = await sql()`select id, action, at from audit_logs where user_id = ${user.uid} and action <> 'PASSWORD_CHECK' order by at desc limit 50`;
  return ok({ items: rows.map((r) => ({ id: String(r.id), action: r.action, at: iso(r.at) })) });
});
