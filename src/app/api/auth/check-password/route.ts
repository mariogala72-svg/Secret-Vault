import { z } from "zod";
import { requireUser, verifyPassword } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

/**
 * Lets the browser make sure the new vault password differs from the login one.
 * Limited to 5 checks per 10 minutes so it cannot be used as a password oracle.
 */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(await req.json());
  const [{ n }] = await sql()`select count(*)::int as n from audit_logs where user_id = ${user.uid} and action = 'PASSWORD_CHECK' and at > now() - interval '10 minutes'`;
  if (n >= 5) throw new HttpError(429, "Troppi tentativi, riprova tra qualche minuto");
  await sql()`insert into audit_logs (user_id, action) values (${user.uid}, 'PASSWORD_CHECK')`;
  const [u] = await sql()`select password_hash from users where id = ${user.uid}`;
  return ok({ sameAsLogin: await verifyPassword(password, u.password_hash) });
});
