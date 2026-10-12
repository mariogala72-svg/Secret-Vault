import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { iso, ok, route } from "@/lib/server/http";
import { emailIndex } from "@/lib/server/seal";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const rows = await sql()`
    select d.id, d.sent_at, d.opened_at, u.display_name
    from deliveries d join users u on u.id = d.owner_id
    where d.email_idx = ${emailIndex(user.email)} and d.status in ('SENT', 'OPENED')
    order by d.sent_at desc nulls last`;
  return ok({ items: rows.map((r) => ({ id: r.id, senderName: r.display_name, sentAt: iso(r.sent_at), openedAt: iso(r.opened_at) })) });
});
