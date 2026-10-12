import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase";

export async function audit(uid: string | null, action: string, meta: Record<string, string | number | boolean | null> = {}) {
  try {
    await db().collection("auditLogs").add({ uid, action, meta, at: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error("[audit] failed", action, e);
  }
}
