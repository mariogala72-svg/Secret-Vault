import { requireRecentLogin, requireUser } from "@/lib/server/auth";
import { adminAuth, db } from "@/lib/server/firebase";
import { ok, route } from "@/lib/server/http";
import { deleteChunks } from "@/lib/server/messages";

/** Right to be forgotten: deleting the vault keys makes every ciphertext unreadable (crypto-shredding). */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  requireRecentLogin(user);
  const uid = user.uid;
  await db().collection("vaults").doc(uid).delete();

  const queries = [
    db().collection("deliveries").where("ownerUid", "==", uid),
    db().collection("executors").where("ownerUid", "==", uid),
    db().collection("deathCases").where("ownerUid", "==", uid),
    db().collection("auditLogs").where("uid", "==", uid),
    db().collection("users").doc(uid).collection("contacts"),
  ];
  const messages = await db().collection("messages").where("ownerUid", "==", uid).get();
  for (const m of messages.docs) await deleteChunks(m.id);
  for (const q of queries) {
    const s = await q.get();
    for (let i = 0; i < s.docs.length; i += 400) {
      const b = db().batch();
      s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  }
  const b = db().batch();
  messages.docs.forEach((m) => b.delete(m.ref));
  b.delete(db().collection("users").doc(uid));
  await b.commit();
  await adminAuth().deleteUser(uid);
  return ok();
});
