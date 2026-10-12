import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

const Contact = z.object({ id: z.string().uuid(), enc: z.string().max(10_000) });

/** Contacts are encrypted in the browser with the vault key: the server stores opaque blobs. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const rows = await sql()`select id, enc from contacts where user_id = ${user.uid}`;
  return ok({ contacts: rows.map((r) => ({ id: r.id, enc: r.enc })) });
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { id, enc } = Contact.parse(await req.json());
  const [r] = await sql()`
    insert into contacts (id, user_id, enc) values (${id}, ${user.uid}, ${enc})
    on conflict (id) do update set enc = excluded.enc, updated_at = now() where contacts.user_id = ${user.uid}
    returning id`;
  if (!r) throw new HttpError(403, "Non autorizzato");
  return ok({ id }, 201);
});
