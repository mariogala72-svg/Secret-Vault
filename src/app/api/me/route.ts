import { after } from "next/server";
import { z } from "zod";
import { currentUser, requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { checkIn, openCaseFor, runMaintenance, switchOf } from "@/lib/server/engine";
import { HttpError, iso, ok, route } from "@/lib/server/http";
import { emailIndex } from "@/lib/server/seal";
import { smsEnabled } from "@/lib/server/sms";

export const GET = route(async (req) => {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, "Accesso richiesto");
  if (!user.emailVerified) return ok({ id: user.uid, displayName: user.name, email: user.email, emailVerified: false });

  const idx = emailIndex(user.email);
  const [[u], [vault], counts, [received], [invites], openCase] = await Promise.all([
    sql()`select * from users where id = ${user.uid}`,
    sql()`select 1 as x from vaults where user_id = ${user.uid}`,
    sql()`select status, count(*)::int as n from messages where owner_id = ${user.uid} group by status`,
    sql()`select count(*)::int as total, count(*) filter (where opened_at is null)::int as unread from deliveries where email_idx = ${idx} and status in ('SENT', 'OPENED')`,
    sql()`select count(*)::int as n from executors where email_idx = ${idx} and status = 'INVITED' and owner_id <> ${user.uid}`,
    openCaseFor(user.uid),
  ]);

  // Signing in counts as a sign of life (once a day).
  if (u.ds_enabled && (!u.ds_last_checkin_at || Date.now() - new Date(u.ds_last_checkin_at).getTime() > 86_400_000)) await checkIn(user.uid);

  after(() => runMaintenance({ minIntervalMs: 120_000 }).catch((e) => console.error("[maintenance]", e)));

  return ok({
    id: user.uid,
    displayName: u.display_name,
    email: user.email,
    emailVerified: true,
    status: u.status,
    hasVault: !!vault,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    received: { total: received.total, unread: received.unread },
    pendingInvitations: invites.n,
    deathSwitch: switchOf(u),
    openCase: openCase ? { id: openCase.id, status: openCase.status, contestUntil: iso(openCase.contest_until) } : null,
    smsEnabled: smsEnabled(),
  });
});

const Body = z.object({ displayName: z.string().trim().min(1).max(80) });

export const POST = route(async (req) => {
  const user = await requireUser(req, { verified: false });
  const { displayName } = Body.parse(await req.json());
  await sql()`update users set display_name = ${displayName} where id = ${user.uid}`;
  return ok();
});
