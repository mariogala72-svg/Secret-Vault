import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const id = z.string().uuid().parse((await params).id);
  const r = await sql()`update executors set status = 'REVOKED' where id = ${id} and owner_id = ${user.uid} returning id`;
  if (!r.length) throw new HttpError(404, "Persona non trovata");
  await audit(user.uid, "EXECUTOR_REVOKED", { executorId: id });
  return ok();
});
