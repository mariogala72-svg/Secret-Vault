import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sweepDueDeliveries } from "@/lib/server/engine";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { getOwnedMessage } from "@/lib/server/messages";

type Ctx = { params: Promise<{ id: string }> };

/** "Send now" for messages kept on hold (or to anticipate a scheduled one). */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const m = await getOwnedMessage(user.uid, (await params).id);
  if (!["HOLD", "SCHEDULED"].includes(m.get("status"))) throw new HttpError(409, "Questo messaggio non può essere inviato ora");
  const ds = await db().collection("deliveries").where("messageId", "==", m.id).get();
  if (ds.docs.some((d) => d.get("keyMode") === "ESCROW_TLOCK")) {
    throw new HttpError(409, "Questo messaggio è sigillato fino alla data scelta: nemmeno noi possiamo anticiparlo");
  }
  const batch = db().batch();
  for (const d of ds.docs) if (["HOLD", "PENDING"].includes(d.get("status"))) batch.update(d.ref, { status: "PENDING", pendingDueAt: Timestamp.now() });
  batch.update(m.ref, { status: "SCHEDULED", "trigger.kind": "MANUAL_NOW", updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  await audit(user.uid, "MESSAGE_SEND_NOW", { messageId: m.id });
  const result = await sweepDueDeliveries();
  return ok(result);
});
