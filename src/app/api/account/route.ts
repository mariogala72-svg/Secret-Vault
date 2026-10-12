import { destroySession, requireRecentLogin, requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { ok, route } from "@/lib/server/http";

/** Right to be forgotten: deleting the vault keys makes every ciphertext unreadable (crypto-shredding). */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  requireRecentLogin(user);
  await sql().begin(async (tx) => {
    await tx`delete from vaults where user_id = ${user.uid}`;
    await tx`delete from chunks where owner_id = ${user.uid}`;
    await tx`delete from audit_logs where user_id = ${user.uid}`;
    await tx`delete from users where id = ${user.uid}`; // cascades to messages, deliveries, contacts, executors, cases, sessions
  });
  await destroySession(req);
  return ok();
});
