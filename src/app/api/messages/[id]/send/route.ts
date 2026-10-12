import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { sweepDueDeliveries } from "@/lib/server/engine";
import { HttpError, ok, route } from "@/lib/server/http";
import { getOwnedMessage } from "@/lib/server/messages";

type Ctx = { params: Promise<{ id: string }> };

/** "Send now" for messages kept on hold (or to anticipate a scheduled one). */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  if (!["HOLD", "SCHEDULED"].includes(m.status)) throw new HttpError(409, "Questo messaggio non può essere inviato ora");
  const [tl] = await sql()`select 1 as x from deliveries where message_id = ${m.id} and key_mode = 'ESCROW_TLOCK' limit 1`;
  if (tl) throw new HttpError(409, "Questo messaggio è sigillato fino alla data scelta: nemmeno noi possiamo anticiparlo");
  await sql().begin(async (tx) => {
    await tx`update deliveries set status = 'PENDING', pending_due_at = now() where message_id = ${m.id} and status in ('HOLD', 'PENDING')`;
    await tx`update messages set status = 'SCHEDULED', trigger = jsonb_set(trigger, '{kind}', '"MANUAL_NOW"'), updated_at = now() where id = ${m.id}`;
  });
  await audit(user.uid, "MESSAGE_SEND_NOW", { messageId: m.id });
  return ok(await sweepDueDeliveries());
});
