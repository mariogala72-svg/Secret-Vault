import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { AuthedUser } from "./auth";
import { db } from "./firebase";
import { HttpError } from "./http";
import { emailIndex } from "./seal";

/** A recipient sees a delivery only once released, and only with the verified email it was addressed to. */
export async function getReceivedDelivery(user: AuthedUser, deliveryId: string): Promise<DocumentSnapshot> {
  const d = await db().collection("deliveries").doc(deliveryId).get();
  const mine = d.exists && (d.get("redeemedBy") === user.uid || d.get("emailIdx") === emailIndex(user.email));
  if (!mine || !["SENT", "OPENED"].includes(d.get("status"))) throw new HttpError(404, "Messaggio non trovato");
  return d;
}

export function assertNotCodeLocked(d: DocumentSnapshot) {
  const until = d.get("codeLockedUntil")?.toMillis?.() ?? 0;
  if (until > Date.now()) throw new HttpError(429, "Troppi tentativi con un codice errato. Riprova domani.", "CODE_LOCKED");
}

export async function canReadMessage(user: AuthedUser, messageId: string): Promise<boolean> {
  const m = await db().collection("messages").doc(messageId).get();
  if (m.exists && m.get("ownerUid") === user.uid) return true;
  const ds = await db().collection("deliveries").where("messageId", "==", messageId).where("emailIdx", "==", emailIndex(user.email)).get();
  return ds.docs.some((d) => ["SENT", "OPENED"].includes(d.get("status")) && !(d.get("codeLockedUntil")?.toMillis?.() > Date.now()));
}
