import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const ref = db().collection("executors").doc((await params).id);
  const e = await ref.get();
  if (!e.exists || e.get("ownerUid") !== user.uid) throw new HttpError(404, "Persona non trovata");
  await ref.update({ status: "REVOKED" });
  await audit(user.uid, "EXECUTOR_REVOKED", { executorId: e.id });
  return ok();
});
