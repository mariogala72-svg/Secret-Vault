import { FieldValue } from "firebase-admin/firestore";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { initialStatuses, sweepDueDeliveries } from "@/lib/server/engine";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { assertChunksUploaded, assertTriggerAllowed, deliveryDoc, MessageSchema, messageView } from "@/lib/server/messages";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const [ms, ds] = await Promise.all([
    db().collection("messages").where("ownerUid", "==", user.uid).select("status", "encTitle", "ownerWrappedDek", "attachments", "trigger", "createdAt", "updatedAt").get(),
    db().collection("deliveries").where("ownerUid", "==", user.uid).get(),
  ]);
  const byMsg = Map.groupBy(ds.docs, (d) => d.get("messageId") as string);
  const messages = ms.docs.map((m) => messageView(m, byMsg.get(m.id) ?? [])).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return ok({ messages });
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const input = MessageSchema.parse(await req.json());
  if (input.deliveries.some((d) => d.keepId)) throw new HttpError(400, "Richiesta non valida");
  await assertTriggerAllowed(user.uid, input);
  await assertChunksUploaded(user.uid, input.id, input.attachments);

  const ref = db().collection("messages").doc(input.id);
  const st = initialStatuses(input.trigger, input.intent);
  await db().runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw new HttpError(409, "Messaggio già esistente");
    tx.set(ref, {
      ownerUid: user.uid,
      status: st.message,
      encTitle: input.encTitle,
      encBody: input.encBody,
      ownerWrappedDek: input.ownerWrappedDek,
      attachments: input.attachments,
      trigger: { kind: input.trigger.kind, fireAt: input.trigger.fireAt ?? null, occasion: input.trigger.occasion ?? null },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const d of input.deliveries) tx.set(db().collection("deliveries").doc(), deliveryDoc(user.uid, input.id, d, st));
  });
  await audit(user.uid, input.intent === "draft" ? "MESSAGE_DRAFT" : "MESSAGE_SCHEDULED", { messageId: input.id, trigger: input.trigger.kind });
  if (input.intent === "schedule" && input.trigger.kind === "MANUAL_NOW") await sweepDueDeliveries();
  return ok({ id: input.id, status: st.message }, 201);
});
