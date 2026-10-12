import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";
import { getOwnedMessage } from "@/lib/server/messages";

type Ctx = { params: Promise<{ id: string }> };

/** Puts a scheduled message back to draft: nothing will be sent. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  if (!["SCHEDULED", "ARMED", "HOLD"].includes(m.status)) throw new HttpError(409, "Questo messaggio non può essere annullato");
  const [busy] = await sql()`select 1 as x from deliveries where message_id = ${m.id} and status in ('SENDING', 'SENT', 'OPENED') limit 1`;
  if (busy) throw new HttpError(409, "Il messaggio è già in consegna");
  await sql().begin(async (tx) => {
    await tx`update deliveries set status = 'DRAFT', pending_due_at = null where message_id = ${m.id}`;
    await tx`update messages set status = 'DRAFT', updated_at = now() where id = ${m.id}`;
  });
  await audit(user.uid, "MESSAGE_UNSCHEDULED", { messageId: m.id });
  return ok();
});
