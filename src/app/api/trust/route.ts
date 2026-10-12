import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { acceptedExecutors, DEFAULT_SWITCH, effectiveQuorum, openCaseFor } from "@/lib/server/engine";
import { db } from "@/lib/server/firebase";
import { iso, ok, route } from "@/lib/server/http";
import { emailIndex, openStr } from "@/lib/server/seal";

/** Everything about the digital will: my settings, my trusted people, and the people who trust me. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const [me, mine, invites, openCase] = await Promise.all([
    db().collection("users").doc(user.uid).get(),
    db().collection("executors").where("ownerUid", "==", user.uid).get(),
    db().collection("executors").where("emailIdx", "==", emailIndex(user.email)).get(),
    openCaseFor(user.uid),
  ]);
  const sw = { ...DEFAULT_SWITCH, ...(me.get("deathSwitch") ?? {}) };

  const trustedBy = [];
  for (const inv of invites.docs) {
    if (inv.get("ownerUid") === user.uid || inv.get("status") === "DECLINED" || inv.get("status") === "REVOKED") continue;
    const owner = await db().collection("users").doc(inv.get("ownerUid")).get();
    let pendingCase = null;
    if (inv.get("status") === "ACCEPTED") {
      const c = await openCaseFor(inv.get("ownerUid"));
      if (c && ["AWAITING_EXECUTORS", "CONTEST"].includes(c.get("status"))) {
        pendingCase = { id: c.id, status: c.get("status"), myDecision: c.get(`decisions.${inv.id}`) ?? null };
      }
    }
    trustedBy.push({ id: inv.id, ownerName: owner.get("displayName"), status: inv.get("status"), ownerDeceased: owner.get("status") === "DECEASED", pendingCase });
  }

  const accepted = mine.docs.filter((d) => d.get("status") === "ACCEPTED").length;
  return ok({
    settings: { ...sw, lastCheckinAt: iso(sw.lastCheckinAt), nextDueAt: iso(sw.nextDueAt) },
    effectiveQuorum: accepted ? effectiveQuorum(sw.quorum, accepted) : 0,
    executors: mine.docs
      .filter((d) => d.get("status") !== "REVOKED")
      .map((d) => ({ id: d.id, name: openStr(d.get("sealedName")), emailMasked: d.get("emailMasked"), status: d.get("status") })),
    openCase: openCase
      ? { id: openCase.id, status: openCase.get("status"), reason: openCase.get("reason"), contestUntil: iso(openCase.get("contestUntil")), confirmations: Object.values(openCase.get("decisions") ?? {}).filter((v) => v === "CONFIRM").length }
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
  const ref = db().collection("users").doc(user.uid);
  const now = Date.now();
  await ref.update({
    "deathSwitch.enabled": s.enabled,
    "deathSwitch.intervalDays": s.intervalDays,
    "deathSwitch.graceDays": 30,
    "deathSwitch.quorum": s.quorum,
    "deathSwitch.contestHours": s.contestHours,
    "deathSwitch.allowUnattended": s.allowUnattended,
    "deathSwitch.lastCheckinAt": Timestamp.fromMillis(now),
    "deathSwitch.nextDueAt": s.enabled ? Timestamp.fromMillis(now + s.intervalDays * 86_400_000) : null,
    remindersSent: 0,
  });
  await audit(user.uid, "WILL_SETTINGS_UPDATED", { enabled: s.enabled, executors: (await acceptedExecutors(user.uid)).length });
  return ok();
});
