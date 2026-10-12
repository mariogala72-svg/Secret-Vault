import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";
import { emailIndex } from "@/lib/server/seal";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const id = z.string().uuid().parse((await params).id);
  const { accept } = z.object({ accept: z.boolean() }).parse(await req.json());
  const [e] = await sql()`
    update executors set
      status = ${accept ? "ACCEPTED" : "DECLINED"},
      executor_id = ${accept ? user.uid : null},
      accepted_at = ${accept ? new Date() : null}
    where id = ${id} and email_idx = ${emailIndex(user.email)} and status <> 'REVOKED' and owner_id <> ${user.uid}
    returning owner_id`;
  if (!e) throw new HttpError(404, "Invito non trovato");
  await audit(e.owner_id, accept ? "EXECUTOR_ACCEPTED" : "EXECUTOR_DECLINED", { executorId: id });
  return ok();
});
