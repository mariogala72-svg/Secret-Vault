import { z } from "zod";
import { canReadMessage } from "@/lib/server/access";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ aid: string; n: string }> };
const MAX_CHUNK = 600 * 1024; // encrypted chunk of 512 KiB + envelope

async function parse(ctx: Ctx) {
  const { aid, n } = await ctx.params;
  const idx = Number(n);
  if (!z.string().uuid().safeParse(aid).success || !Number.isInteger(idx) || idx < 0 || idx > 63) throw new HttpError(400, "Richiesta non valida");
  return { aid, idx };
}

/** Uploads one encrypted chunk (already encrypted in the browser). */
export const PUT = route<Ctx>(async (req, ctx) => {
  const user = await requireUser(req);
  const { aid, idx } = await parse(ctx);
  const messageId = new URL(req.url).searchParams.get("messageId") ?? "";
  if (!z.string().uuid().safeParse(messageId).success) throw new HttpError(400, "Richiesta non valida");
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length === 0 || data.length > MAX_CHUNK) throw new HttpError(413, "Blocco troppo grande");
  const [other] = await sql()`select 1 as x from messages where id = ${messageId} and owner_id <> ${user.uid}`;
  if (other) throw new HttpError(403, "Non autorizzato");
  const r = await sql()`
    insert into chunks (aid, n, owner_id, message_id, data) values (${aid}, ${idx}, ${user.uid}, ${messageId}, ${data})
    on conflict (aid, n) do update set data = excluded.data, message_id = excluded.message_id where chunks.owner_id = ${user.uid}
    returning aid`;
  if (!r.length) throw new HttpError(403, "Non autorizzato");
  return ok({}, 201);
});

export const GET = route<Ctx>(async (req, ctx) => {
  const user = await requireUser(req);
  const { aid, idx } = await parse(ctx);
  const [c] = await sql()`select message_id, data from chunks where aid = ${aid} and n = ${idx}`;
  if (!c || !(await canReadMessage(user, c.message_id))) throw new HttpError(404, "Allegato non trovato");
  return new Response(new Uint8Array(c.data), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
});
