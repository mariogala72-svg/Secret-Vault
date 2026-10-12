import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { emailIndex } from "@/lib/server/seal";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { accept } = z.object({ accept: z.boolean() }).parse(await req.json());
  const ref = db().collection("executors").doc((await params).id);
  const e = await ref.get();
  if (!e.exists || e.get("emailIdx") !== emailIndex(user.email) || e.get("status") === "REVOKED") throw new HttpError(404, "Invito non trovato");
  await ref.update(accept ? { status: "ACCEPTED", executorUid: user.uid, acceptedAt: FieldValue.serverTimestamp() } : { status: "DECLINED", executorUid: null });
  await audit(e.get("ownerUid"), accept ? "EXECUTOR_ACCEPTED" : "EXECUTOR_DECLINED", { executorId: e.id });
  return ok();
});
