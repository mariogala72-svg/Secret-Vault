import { z } from "zod";
import { requireUser, verifyPassword } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

/** Step-up authentication before sensitive actions. */
export const POST = route(async (req) => {
  const user = await requireUser(req, { verified: false });
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(await req.json());
  const [u] = await sql()`select password_hash from users where id = ${user.uid}`;
  if (!(await verifyPassword(password, u.password_hash))) throw new HttpError(401, "Password non corretta");
  await sql()`update sessions set reauth_at = now() where token_hash = ${user.sessionHash}`;
  return ok();
});
