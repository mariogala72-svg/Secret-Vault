import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { consumeToken, hashPassword } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

const Body = z.object({ token: z.string().min(20).max(200), password: z.string().min(10).max(200) });

export const POST = route(async (req) => {
  const { token, password } = Body.parse(await req.json());
  const uid = await consumeToken(token, "RESET_PASSWORD");
  if (!uid) throw new HttpError(400, "Il link non è valido o è scaduto. Richiedine uno nuovo.");
  await sql()`
    update users set password_hash = ${await hashPassword(password)}, failed_logins = 0, login_locked_until = null,
      email_verified_at = coalesce(email_verified_at, now())
    where id = ${uid}`;
  // Signs out every device.
  await sql()`delete from sessions where user_id = ${uid}`;
  await audit(uid, "PASSWORD_RESET");
  return ok();
});
