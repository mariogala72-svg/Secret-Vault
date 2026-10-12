import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { AuthedUser } from "./auth";
import { db } from "./firebase";
import { emailIndex } from "./seal";

export async function ensureUser(u: AuthedUser, displayName?: string) {
  const ref = db().collection("users").doc(u.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      displayName: (displayName || u.name || u.email.split("@")[0]).slice(0, 80),
      email: u.email,
      emailIdx: emailIndex(u.email),
      status: "ACTIVE",
      createdAt: FieldValue.serverTimestamp(),
    });
    return ref.get();
  }
  if (snap.get("email") !== u.email) await ref.update({ email: u.email, emailIdx: emailIndex(u.email) });
  return snap;
}
