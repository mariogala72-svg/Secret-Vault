import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { iso, ok, route } from "@/lib/server/http";
import { emailIndex } from "@/lib/server/seal";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const ds = await db().collection("deliveries").where("emailIdx", "==", emailIndex(user.email)).get();
  const released = ds.docs.filter((d) => ["SENT", "OPENED"].includes(d.get("status")));
  const owners = new Map<string, string>();
  for (const uid of new Set(released.map((d) => d.get("ownerUid") as string))) {
    const u = await db().collection("users").doc(uid).get();
    owners.set(uid, u.get("displayName") ?? "Una persona a te cara");
  }
  const items = released
    .map((d) => ({ id: d.id, senderName: owners.get(d.get("ownerUid")), sentAt: iso(d.get("sentAt")), openedAt: iso(d.get("openedAt")) }))
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  return ok({ items });
});
