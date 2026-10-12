import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { createSession, verifyDummy, verifyPassword } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";
import { normalizeEmail } from "@/lib/server/seal";

const Body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });
const INVALID = "Email o password non corretti";

export const POST = route(async (req) => {
  const { email, password } = Body.parse(await req.json());
  const [u] = await sql()`select id, password_hash, failed_logins, login_locked_until from users where email = ${normalizeEmail(email)}`;
  if (!u) {
    await verifyDummy(password);
    throw new HttpError(401, INVALID);
  }
  if (u.login_locked_until && new Date(u.login_locked_until).getTime() > Date.now()) {
    throw new HttpError(429, "Troppi tentativi. Riprova tra qualche minuto");
  }
  if (!(await verifyPassword(password, u.password_hash))) {
    // 5 failures -> 15 minutes lock, doubling afterwards.
    const n = u.failed_logins + 1;
    const lock = n % 5 === 0 ? new Date(Date.now() + 15 * 60_000 * 2 ** (n / 5 - 1)) : null;
    await sql()`update users set failed_logins = ${n}, login_locked_until = coalesce(${lock}, login_locked_until) where id = ${u.id}`;
    await audit(u.id, "LOGIN_FAILED");
    throw new HttpError(401, INVALID);
  }
  await sql()`update users set failed_logins = 0, login_locked_until = null where id = ${u.id}`;
  await createSession(u.id, req);
  await audit(u.id, "LOGIN");
  return ok();
});
