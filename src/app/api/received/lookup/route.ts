import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";
import { sha256 } from "@/lib/server/seal";

/** Public: from the link token, shows who wrote and which address it was sent to (masked). */
export const GET = route(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token.length < 20 || token.length > 100) throw new HttpError(404, "Link non valido");
  const [d] = await sql()`
    select d.email_masked, u.display_name, u.status
    from deliveries d join users u on u.id = d.owner_id
    where d.link_token_hash = ${sha256(token)} and d.status in ('SENT', 'OPENED')`;
  if (!d) throw new HttpError(404, "Link non valido o scaduto");
  return ok({ senderName: d.display_name, emailMasked: d.email_masked, postMortem: d.status === "DECEASED" });
});
