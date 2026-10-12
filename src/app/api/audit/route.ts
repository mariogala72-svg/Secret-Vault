import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { iso, ok, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const s = await db().collection("auditLogs").where("uid", "==", user.uid).limit(300).get();
  const items = s.docs
    .map((d) => ({ id: d.id, action: d.get("action") as string, at: iso(d.get("at")) }))
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, 50);
  return ok({ items });
});
