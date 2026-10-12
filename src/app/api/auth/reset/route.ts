import { z } from "zod";
import { issueToken } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { sendTemplate, templates } from "@/lib/server/email";
import { appUrl, ok, route } from "@/lib/server/http";
import { normalizeEmail } from "@/lib/server/seal";

const Body = z.object({ email: z.string().email().max(200) });

// Always answers the same way, so it cannot be used to discover registered emails.
export const POST = route(async (req) => {
  const { email } = Body.parse(await req.json());
  const [u] = await sql()`select id, email from users where email = ${normalizeEmail(email)}`;
  if (u) {
    const token = await issueToken(u.id, "RESET_PASSWORD", 30);
    await sendTemplate(u.email, templates.resetPassword(`${appUrl(req)}/reset-password?t=${token}`)).catch((e) => console.error("[reset]", e));
  }
  return ok();
});
