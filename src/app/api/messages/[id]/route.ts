import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { initialStatuses, sweepDueDeliveries } from "@/lib/server/engine";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { assertChunksUploaded, assertTriggerAllowed, deleteChunks, deliveryDoc, getOwnedMessage, MessageSchema, messageView } from "@/lib/server/messages";

type Ctx = { params: Promise<{ id: string }> };
const EDITABLE = ["DRAFT", "SCHEDULED", "ARMED", "HOLD"];

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  const ds = await db().collection("deliveries").where("messageId", "==", m.id).get();
  return ok({ message: messageView(m, ds.docs, true) });
});

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const input = MessageSchema.parse(await req.json());
  if (input.id !== id) throw new HttpError(400, "Richiesta non valida");
  const m = await getOwnedMessage(user.uid, id);
  if (!EDITABLE.includes(m.get("status"))) throw new HttpError(409, "Questo messaggio non può più essere modificato");
  const existing = await db().collection("deliveries").where("messageId", "==", id).get();
  if (existing.docs.some((d) => ["SENDING", "SENT", "OPENED"].includes(d.get("status")))) throw new HttpError(409, "Il messaggio è già in consegna");
  await assertTriggerAllowed(user.uid, input);
  await assertChunksUploaded(user.uid, id, input.attachments);

  const oldTrigger = m.get("trigger");
  const st = initialStatuses(input.trigger, input.intent);
  const keep = new Set(input.deliveries.filter((d) => d.keepId).map((d) => d.keepId!));
  const batch = db().batch();
  for (const d of existing.docs) {
    if (!keep.has(d.id)) {
      batch.delete(d.ref);
      continue;
    }
    // A timelocked code is bound to the original date: it cannot be kept if the date changes.
    if (d.get("keyMode") === "ESCROW_TLOCK" && (input.trigger.kind !== "FIXED_DATE" || input.trigger.fireAt !== oldTrigger?.fireAt)) {
      throw new HttpError(400, "Il codice a tempo va rigenerato quando cambi la data");
    }
    batch.update(d.ref, {
      status: st.delivery,
      pendingDueAt: st.delivery === "PENDING" && st.dueAt ? Timestamp.fromDate(st.dueAt) : null,
      dueAt: st.dueAt ? Timestamp.fromDate(st.dueAt) : null,
    });
  }
  for (const d of input.deliveries.filter((d) => !d.keepId)) batch.set(db().collection("deliveries").doc(), deliveryDoc(user.uid, id, d, st));
  batch.update(m.ref, {
    status: st.message,
    encTitle: input.encTitle,
    encBody: input.encBody,
    attachments: input.attachments,
    trigger: { kind: input.trigger.kind, fireAt: input.trigger.fireAt ?? null, occasion: input.trigger.occasion ?? null },
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  await deleteChunks(id, input.attachments.map((a) => a.id));
  await audit(user.uid, "MESSAGE_UPDATED", { messageId: id, trigger: input.trigger.kind });
  if (input.intent === "schedule" && input.trigger.kind === "MANUAL_NOW") await sweepDueDeliveries();
  return ok({ id, status: st.message });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  const ds = await db().collection("deliveries").where("messageId", "==", m.id).get();
  const batch = db().batch();
  ds.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(m.ref);
  await batch.commit();
  await deleteChunks(m.id);
  await audit(user.uid, "MESSAGE_DELETED", { messageId: m.id });
  return ok();
});
