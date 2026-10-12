import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { recordExecutorDecision } from "@/lib/server/engine";
import { HttpError, ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ decision: z.enum(["CONFIRM", "DENY"]) });

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const caseId = z.string().uuid().parse((await params).id);
  const { decision } = Body.parse(await req.json());
  const [me] = await sql()`
    select e.id from death_cases c join executors e on e.owner_id = c.owner_id
    where c.id = ${caseId} and e.executor_id = ${user.uid} and e.status = 'ACCEPTED'`;
  if (!me) throw new HttpError(403, "Non autorizzato");
  return ok({ status: await recordExecutorDecision(caseId, me.id, decision) });
});
