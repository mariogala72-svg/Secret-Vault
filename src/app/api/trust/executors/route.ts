import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { sendTemplate, templates } from "@/lib/server/email";
import { appUrl, HttpError, ok, route } from "@/lib/server/http";
import { emailIndex, maskEmail, normalizeEmail, sealStr } from "@/lib/server/seal";

const Body = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().max(200) });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { name, email: raw } = Body.parse(await req.json());
  const email = normalizeEmail(raw);
  if (email === user.email) throw new HttpError(400, "Non puoi nominare te stesso");
  const active = await sql()`select email_idx from executors where owner_id = ${user.uid} and status <> 'REVOKED'`;
  if (active.length >= 5) throw new HttpError(400, "Puoi nominare al massimo 5 persone di fiducia");
  if (active.some((d) => d.email_idx === emailIndex(email))) throw new HttpError(409, "Hai già invitato questa persona");

  const [e] = await sql()`
    insert into executors (owner_id, sealed_name, sealed_email, email_idx, email_masked)
    values (${user.uid}, ${sealStr(name)}, ${sealStr(email)}, ${emailIndex(email)}, ${maskEmail(email)})
    returning id`;
  await sendTemplate(email, templates.executorInvite({ executorName: name, ownerName: user.name, link: `${appUrl(req)}/app/trust` }), `executor-invite-${e.id}`);
  await audit(user.uid, "EXECUTOR_INVITED", { executorId: e.id });
  return ok({ id: e.id }, 201);
});
