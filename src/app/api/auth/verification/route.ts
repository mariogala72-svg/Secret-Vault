import { requireUser } from "@/lib/server/auth";
import { sendTemplate, templates } from "@/lib/server/email";
import { adminAuth, db } from "@/lib/server/firebase";
import { appUrl, HttpError, ok, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const user = await requireUser(req, { verified: false });
  if (user.emailVerified) return ok({ alreadyVerified: true });
  const ref = db().collection("users").doc(user.uid);
  const snap = await ref.get();
  const last = snap.get("verificationSentAt")?.toMillis?.() ?? 0;
  if (Date.now() - last < 60_000) throw new HttpError(429, "Attendi un minuto prima di richiedere un'altra email");
  const link = await adminAuth().generateEmailVerificationLink(user.email, { url: `${appUrl(req)}/login?verified=1` });
  await sendTemplate(user.email, templates.verifyEmail(snap.get("displayName") ?? "", link));
  await ref.set({ verificationSentAt: new Date() }, { merge: true });
  return ok();
});
