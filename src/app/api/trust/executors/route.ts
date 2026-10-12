import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sendTemplate, templates } from "@/lib/server/email";
import { db } from "@/lib/server/firebase";
import { appUrl, HttpError, ok, route } from "@/lib/server/http";
import { emailIndex, maskEmail, normalizeEmail, sealStr } from "@/lib/server/seal";

const Body = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().max(200) });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { name, email: raw } = Body.parse(await req.json());
  const email = normalizeEmail(raw);
  if (email === user.email) throw new HttpError(400, "Non puoi nominare te stesso");
  const existing = await db().collection("executors").where("ownerUid", "==", user.uid).get();
  const active = existing.docs.filter((d) => d.get("status") !== "REVOKED");
  if (active.length >= 5) throw new HttpError(400, "Puoi nominare al massimo 5 persone di fiducia");
  if (active.some((d) => d.get("emailIdx") === emailIndex(email))) throw new HttpError(409, "Hai già invitato questa persona");

  const owner = await db().collection("users").doc(user.uid).get();
  const ref = await db().collection("executors").add({
    ownerUid: user.uid,
    sealedName: sealStr(name),
    sealedEmail: sealStr(email),
    emailIdx: emailIndex(email),
    emailMasked: maskEmail(email),
    status: "INVITED",
    createdAt: FieldValue.serverTimestamp(),
  });
  await sendTemplate(email, templates.executorInvite({ executorName: name, ownerName: owner.get("displayName"), link: `${appUrl(req)}/app/trust` }), `executor-invite-${ref.id}`);
  await audit(user.uid, "EXECUTOR_INVITED", { executorId: ref.id });
  return ok({ id: ref.id }, 201);
});
