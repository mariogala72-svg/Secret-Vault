import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { effectiveQuorum, openCaseFor, switchOf } from "@/lib/server/engine";
import { iso, ok, route } from "@/lib/server/http";
import { emailIndex, openStr } from "@/lib/server/seal";

/** Everything about the digital will: my settings, my trusted people, and the people who trust me. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const [[me], mine, invites, openCase] = await Promise.all([
    sql()`select * from users where id = ${user.uid}`,
    sql()`select * from executors where owner_id = ${user.uid} and status <> 'REVOKED' order by created_at`,
    sql()`
      select e.id, e.status, u.id as owner_id, u.display_name, u.status as owner_status
      from executors e join users u on u.id = e.owner_id
      where e.email_idx = ${emailIndex(user.email)} and e.owner_id <> ${user.uid} and e.status in ('INVITED', 'ACCEPTED')`,
    openCaseFor(user.uid),
  ]);

  const trustedBy = [];
  for (const inv of invites) {
    let pendingCase = null;
    if (inv.status === "ACCEPTED") {
      const c = await openCaseFor(inv.owner_id);
      if (c && ["AWAITING_EXECUTORS", "CONTEST"].includes(c.status)) {
        pendingCase = { id: c.id, status: c.status, myDecision: (c.decisions as Record<string, string>)[inv.id] ?? null };
      }
    }
    trustedBy.push({ id: inv.id, ownerName: inv.display_name, status: inv.status, ownerDeceased: inv.owner_status === "DECEASED", pendingCase });
  }

  const sw = switchOf(me);
  const accepted = mine.filter((d) => d.status === "ACCEPTED").length;
  return ok({
    settings: sw,
    effectiveQuorum: accepted ? effectiveQuorum(sw.quorum, accepted) : 0,
    executors: mine.map((d) => ({ id: d.id, name: openStr(d.sealed_name), emailMasked: d.email_masked, status: d.status })),
    openCase: openCase
      ? {
          id: openCase.id,
          status: openCase.status,
          reason: openCase.reason,
          contestUntil: iso(openCase.contest_until),
          confirmations: Object.values(openCase.decisions as Record<string, string>).filter((v) => v === "CONFIRM").length,
        }
      : null,
    trustedBy,
  });
});

const Settings = z.object({
  enabled: z.boolean(),
  intervalDays: z.number().int().min(30).max(365),
  quorum: z.number().int().min(1).max(5),
  contestHours: z.number().int().min(24).max(336),
  allowUnattended: z.boolean(),
});

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const s = Settings.parse(await req.json());
  await sql()`
    update users set
      ds_enabled = ${s.enabled}, ds_interval_days = ${s.intervalDays}, ds_grace_days = 30, ds_quorum = ${s.quorum},
      ds_contest_hours = ${s.contestHours}, ds_allow_unattended = ${s.allowUnattended},
      ds_last_checkin_at = now(),
      ds_next_due_at = ${s.enabled ? new Date(Date.now() + s.intervalDays * 86_400_000) : null},
      ds_reminders_sent = 0
    where id = ${user.uid}`;
  await audit(user.uid, "WILL_SETTINGS_UPDATED", { enabled: s.enabled });
  return ok();
});
