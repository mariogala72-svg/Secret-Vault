import { FieldValue } from "firebase-admin/firestore";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { getOwnedMessage } from "@/lib/server/messages";

type Ctx = { params: Promise<{ id: string }> };

/** Puts a scheduled message back to draft: nothing will be sent. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  if (!["SCHEDULED", "ARMED", "HOLD"].includes(m.get("status"))) throw new HttpError(409, "Questo messaggio non può essere annullato");
  const ds = await db().collection("deliveries").where("messageId", "==", m.id).get();
  if (ds.docs.some((d) => ["SENDING", "SENT", "OPENED"].includes(d.get("status")))) throw new HttpError(409, "Il messaggio è già in consegna");
  const batch = db().batch();
  ds.docs.forEach((d) => batch.update(d.ref, { status: "DRAFT", pendingDueAt: null }));
  batch.update(m.ref, { status: "DRAFT", updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  await audit(user.uid, "MESSAGE_UNSCHEDULED", { messageId: m.id });
  return ok();
});
