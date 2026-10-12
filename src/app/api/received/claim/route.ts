import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";
import { emailIndex, sha256 } from "@/lib/server/seal";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { token } = z.object({ token: z.string().min(20).max(100) }).parse(await req.json());
  const [d] = await sql()`select id, email_idx, email_masked, redeemed_by from deliveries where link_token_hash = ${sha256(token)} and status in ('SENT', 'OPENED')`;
  if (!d) throw new HttpError(404, "Link non valido o scaduto");
  if (d.email_idx !== emailIndex(user.email)) {
    throw new HttpError(403, `Questo messaggio è indirizzato a ${d.email_masked}. Accedi con quell'indirizzo email.`, "WRONG_ACCOUNT");
  }
  if (!d.redeemed_by) await sql()`update deliveries set redeemed_by = ${user.uid} where id = ${d.id}`;
  return ok({ deliveryId: d.id });
});
