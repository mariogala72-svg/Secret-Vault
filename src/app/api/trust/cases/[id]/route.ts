import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { recordExecutorDecision } from "@/lib/server/engine";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ decision: z.enum(["CONFIRM", "DENY"]) });

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { decision } = Body.parse(await req.json());
  const c = await db().collection("deathCases").doc((await params).id).get();
  if (!c.exists) throw new HttpError(404, "Richiesta non trovata");
  const execs = await db().collection("executors").where("ownerUid", "==", c.get("ownerUid")).where("executorUid", "==", user.uid).get();
  const me = execs.docs.find((d) => d.get("status") === "ACCEPTED");
  if (!me) throw new HttpError(403, "Non autorizzato");
  const status = await recordExecutorDecision(c.id, me.id, decision);
  return ok({ status });
});
