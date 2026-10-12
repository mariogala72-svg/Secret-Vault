import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { checkIn, DEFAULT_SWITCH, openCaseFor, runMaintenance } from "@/lib/server/engine";
import { db } from "@/lib/server/firebase";
import { iso, ok, route } from "@/lib/server/http";
import { emailIndex } from "@/lib/server/seal";
import { smsEnabled } from "@/lib/server/sms";
import { ensureUser } from "@/lib/server/users";

export const GET = route(async (req) => {
  const user = await requireUser(req, { verified: false });
  const snap = await ensureUser(user);
  if (!user.emailVerified) {
    return ok({ displayName: snap.get("displayName"), email: user.email, emailVerified: false });
  }
  const [vault, messages, received, invitations, openCase] = await Promise.all([
    db().collection("vaults").doc(user.uid).get(),
    db().collection("messages").where("ownerUid", "==", user.uid).select("status").get(),
    db().collection("deliveries").where("emailIdx", "==", emailIndex(user.email)).select("status", "openedAt").get(),
    db().collection("executors").where("emailIdx", "==", emailIndex(user.email)).select("status").get(),
    openCaseFor(user.uid),
  ]);

  const sw = { ...DEFAULT_SWITCH, ...(snap.get("deathSwitch") ?? {}) };
  // Signing in counts as a sign of life (once a day).
  const last = snap.get("deathSwitch.lastCheckinAt")?.toMillis?.() ?? 0;
  if (sw.enabled && Date.now() - last > 86_400_000) await checkIn(user.uid);

  const counts: Record<string, number> = {};
  for (const m of messages.docs) counts[m.get("status")] = (counts[m.get("status")] ?? 0) + 1;
  const rec = received.docs.filter((d) => ["SENT", "OPENED"].includes(d.get("status")));

  after(() => runMaintenance({ minIntervalMs: 120_000 }).catch((e) => console.error("[maintenance]", e)));

  return ok({
    displayName: snap.get("displayName"),
    email: user.email,
    emailVerified: true,
    status: snap.get("status"),
    hasVault: vault.exists,
    counts,
    received: { total: rec.length, unread: rec.filter((d) => !d.get("openedAt")).length },
    pendingInvitations: invitations.docs.filter((d) => d.get("status") === "INVITED").length,
    deathSwitch: { ...sw, lastCheckinAt: iso(sw.lastCheckinAt), nextDueAt: iso(sw.nextDueAt) },
    openCase: openCase ? { id: openCase.id, status: openCase.get("status"), contestUntil: iso(openCase.get("contestUntil")) } : null,
    smsEnabled: smsEnabled(),
  });
});

const Body = z.object({ displayName: z.string().trim().min(1).max(80) });

export const POST = route(async (req) => {
  const user = await requireUser(req, { verified: false });
  const { displayName } = Body.parse(await req.json());
  const snap = await ensureUser(user, displayName);
  await snap.ref.update({ displayName });
  return ok();
});
