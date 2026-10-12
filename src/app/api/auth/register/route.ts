import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { createSession, hashPassword, issueToken } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { sendTemplate, templates } from "@/lib/server/email";
import { appUrl, HttpError, ok, route } from "@/lib/server/http";
import { normalizeEmail } from "@/lib/server/seal";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(10).max(200),
});

export const POST = route(async (req) => {
  const { name, email: raw, password } = Body.parse(await req.json());
  const email = normalizeEmail(raw);
  const [user] = await sql()`
    insert into users (email, display_name, password_hash, verification_sent_at)
    values (${email}, ${name}, ${await hashPassword(password)}, now())
    on conflict (email) do nothing
    returning id`;
  if (!user) throw new HttpError(409, "Esiste già un account con questa email");
  const token = await issueToken(user.id, "VERIFY_EMAIL", 24 * 60);
  await sendTemplate(email, templates.verifyEmail(name, `${appUrl(req)}/api/auth/verify?t=${token}`));
  await createSession(user.id, req);
  await audit(user.id, "ACCOUNT_CREATED");
  return ok({}, 201);
});
