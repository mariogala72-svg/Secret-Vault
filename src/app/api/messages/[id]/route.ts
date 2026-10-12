import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { initialStatuses, sweepDueDeliveries } from "@/lib/server/engine";
import { HttpError, ok, route } from "@/lib/server/http";
import { assertChunksUploaded, assertTriggerAllowed, deleteChunks, deliveryRow, getOwnedMessage, MessageSchema, messageView, triggerJson } from "@/lib/server/messages";

type Ctx = { params: Promise<{ id: string }> };
const EDITABLE = ["DRAFT", "SCHEDULED", "ARMED", "HOLD"];

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  const ds = await sql()`select * from deliveries where message_id = ${m.id} order by created_at`;
  return ok({ message: messageView(m, ds, true) });
});

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const input = MessageSchema.parse(await req.json());
  if (input.id !== id) throw new HttpError(400, "Richiesta non valida");
  const m = await getOwnedMessage(user.uid, id);
  if (!EDITABLE.includes(m.status)) throw new HttpError(409, "Questo messaggio non può più essere modificato");
  const existing = await sql()`select * from deliveries where message_id = ${id}`;
  if (existing.some((d) => ["SENDING", "SENT", "OPENED"].includes(d.status))) throw new HttpError(409, "Il messaggio è già in consegna");
  await assertTriggerAllowed(user.uid, input);
  await assertChunksUploaded(user.uid, id, input.attachments);

  const oldTrigger = m.trigger as { fireAt?: string | null };
  const st = initialStatuses(input.trigger, input.intent);
  const keep = new Set(input.deliveries.filter((d) => d.keepId).map((d) => d.keepId!));
  for (const d of existing) {
    // A timelocked code is bound to the original date: it cannot be kept if the date changes.
    if (keep.has(d.id) && d.key_mode === "ESCROW_TLOCK" && (input.trigger.kind !== "FIXED_DATE" || input.trigger.fireAt !== oldTrigger?.fireAt)) {
      throw new HttpError(400, "Il codice a tempo va rigenerato quando cambi la data");
    }
  }
  await sql().begin(async (tx) => {
    for (const d of existing) {
      if (!keep.has(d.id)) await tx`delete from deliveries where id = ${d.id}`;
      else await tx`update deliveries set status = ${st.delivery}, pending_due_at = ${st.delivery === "PENDING" ? st.dueAt : null}, due_at = ${st.dueAt} where id = ${d.id}`;
    }
    for (const d of input.deliveries.filter((d) => !d.keepId)) await tx`insert into deliveries ${tx(deliveryRow(user.uid, id, d, st))}`;
    await tx`
      update messages set status = ${st.message}, enc_title = ${input.encTitle}, enc_body = ${input.encBody},
        attachments = ${tx.json(input.attachments)}, trigger = ${tx.json(triggerJson(input.trigger))}, updated_at = now()
      where id = ${id}`;
  });
  await deleteChunks(id, input.attachments.map((a) => a.id));
  await audit(user.uid, "MESSAGE_UPDATED", { messageId: id, trigger: input.trigger.kind });
  if (input.intent === "schedule" && input.trigger.kind === "MANUAL_NOW") await sweepDueDeliveries();
  return ok({ id, status: st.message });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  await sql()`delete from messages where id = ${m.id}`; // deliveries cascade
  await deleteChunks(m.id);
  await audit(user.uid, "MESSAGE_DELETED", { messageId: m.id });
  return ok();
});
