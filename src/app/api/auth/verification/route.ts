import { issueToken, requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { sendTemplate, templates } from "@/lib/server/email";
import { appUrl, HttpError, ok, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const user = await requireUser(req, { verified: false });
  if (user.emailVerified) return ok({ alreadyVerified: true });
  const [u] = await sql()`
    update users set verification_sent_at = now()
    where id = ${user.uid} and (verification_sent_at is null or verification_sent_at < now() - interval '1 minute')
    returning display_name`;
  if (!u) throw new HttpError(429, "Attendi un minuto prima di richiedere un'altra email");
  const token = await issueToken(user.uid, "VERIFY_EMAIL", 24 * 60);
  await sendTemplate(user.email, templates.verifyEmail(u.display_name, `${appUrl(req)}/api/auth/verify?t=${token}`));
  return ok();
});
