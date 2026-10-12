import { z } from "zod";
import { getReceivedDelivery } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { esc, sendEmail } from "@/lib/server/email";
import { HttpError, ok, route } from "@/lib/server/http";
import { openStr } from "@/lib/server/seal";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ type: z.enum(["code-failed", "opened", "resend-code"]) });

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { type } = Body.parse(await req.json());
  const d = await getReceivedDelivery(user, (await params).id);

  if (type === "code-failed") {
    const [r] = await sql()`
      update deliveries set
        failed_code_attempts = case when failed_code_attempts + 1 >= 5 then 0 else failed_code_attempts + 1 end,
        code_locked_until = case when failed_code_attempts + 1 >= 5 then now() + interval '24 hours' else code_locked_until end
      where id = ${d.id} returning failed_code_attempts, code_locked_until`;
    await audit(d.owner_id as string, "RECIPIENT_CODE_FAILED", { deliveryId: d.id as string });
    const locked = r.code_locked_until && new Date(r.code_locked_until).getTime() > Date.now();
    return ok({ remaining: locked ? 0 : 5 - r.failed_code_attempts });
  }

  if (type === "opened") {
    const r = await sql()`
      update deliveries set status = 'OPENED', opened_at = now(), redeemed_by = ${user.uid}, failed_code_attempts = 0
      where id = ${d.id} and opened_at is null returning id`;
    if (r.length) await audit(d.owner_id as string, "DELIVERY_OPENED", { deliveryId: d.id as string });
    return ok();
  }

  // resend-code: only while the reserve exists, at most every 10 minutes, to the original address.
  if (!d.code_reserve_sealed) throw new HttpError(409, "Il codice non è più disponibile");
  const r = await sql()`
    update deliveries set code_resent_at = now()
    where id = ${d.id} and (code_resent_at is null or code_resent_at < now() - interval '10 minutes') returning id`;
  if (!r.length) throw new HttpError(429, "Ti abbiamo già inviato il codice da poco, controlla la tua email");
  const [owner] = await sql()`select display_name from users where id = ${d.owner_id}`;
  await sendEmail(openStr(d.sealed_email as string), "Il tuo codice di accesso · Secret Vault", "Ecco il tuo codice", [
    { p: `Questo è il codice per aprire il messaggio di <strong>${esc(owner.display_name)}</strong>:` },
    { code: openStr(d.code_reserve_sealed as string, "escrow") },
  ]);
  return ok();
});
