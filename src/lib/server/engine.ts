import "server-only";
import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { mainnetClient, timelockDecrypt } from "tlock-js";
import { audit } from "./audit";
import { sendTemplate, templates } from "./email";
import { db } from "./firebase";
import { appUrl } from "./http";
import { openStr, randomToken, sealStr, sha256, signToken } from "./seal";
import { sendSms, smsEnabled } from "./sms";
import type { DeathSwitch, DeliveryStatus, MessageStatus, Trigger } from "../types";

const DAY = 86_400_000;
const RETRY_MINUTES = [1, 5, 30, 120, 720];
const LEASE_MS = 10 * 60_000;

// ------------------------------------------------------------------ status helpers

export function initialStatuses(trigger: Trigger, intent: "draft" | "schedule"): { message: MessageStatus; delivery: DeliveryStatus; dueAt: Date | null } {
  if (intent === "draft") return { message: "DRAFT", delivery: "DRAFT", dueAt: null };
  switch (trigger.kind) {
    case "FIXED_DATE":
      return { message: "SCHEDULED", delivery: "PENDING", dueAt: new Date(trigger.fireAt!) };
    case "MANUAL_NOW":
      return { message: "SCHEDULED", delivery: "PENDING", dueAt: new Date() };
    case "MANUAL_LATER":
      return { message: "HOLD", delivery: "HOLD", dueAt: null };
    case "DEATH":
      return { message: "ARMED", delivery: "WAITING", dueAt: null };
    case "DATE_OR_DEATH":
      return { message: "ARMED", delivery: "PENDING", dueAt: new Date(trigger.fireAt!) };
  }
}

export async function recomputeMessageStatus(messageId: string) {
  const ref = db().collection("messages").doc(messageId);
  const [msg, ds] = await Promise.all([ref.get(), db().collection("deliveries").where("messageId", "==", messageId).get()]);
  if (!msg.exists || ds.empty) return;
  const st = ds.docs.map((d) => d.get("status") as DeliveryStatus);
  const done = st.filter((s) => s === "SENT" || s === "OPENED").length;
  const failed = st.filter((s) => s === "FAILED").length;
  let status: MessageStatus | null = null;
  if (done === st.length) status = "DELIVERED";
  else if (done + failed === st.length) status = done > 0 ? "PARTIAL" : "FAILED";
  if (status && msg.get("status") !== status) await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

// ------------------------------------------------------------------ delivery

function romeHour(d: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(d));
}

/** Post-mortem notifications are never sent at night (Europe/Rome). */
function nextQuietSafeTime(now: Date): Date | null {
  const h = romeHour(now);
  if (h >= 8 && h < 21) return null;
  const t = new Date(now);
  t.setUTCMinutes(0, 0, 0);
  do t.setTime(t.getTime() + 3_600_000);
  while (romeHour(t) !== 8);
  return t;
}

async function claim(ref: FirebaseFirestore.DocumentReference): Promise<DocumentSnapshot | null> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const due = snap.get("pendingDueAt") as Timestamp | null;
    const status = snap.get("status");
    if (!due || due.toMillis() > Date.now() || (status !== "PENDING" && status !== "SENDING")) return null;
    tx.update(ref, { status: "SENDING", pendingDueAt: Timestamp.fromMillis(Date.now() + LEASE_MS) });
    return snap;
  });
}

async function revealCode(d: DocumentSnapshot): Promise<string | null> {
  const mode = d.get("keyMode");
  if (mode === "SENDER_SHARES_CODE") return null;
  const reserve = d.get("codeReserveSealed");
  if (reserve) return openStr(reserve, "escrow");
  const escrow = openStr(d.get("escrowSealed"), "escrow");
  if (mode === "ESCROW_SERVER") return escrow;
  // ESCROW_TLOCK: only openable once the drand network has published the round for the delivery date.
  const plain = await timelockDecrypt(escrow, mainnetClient());
  return plain.toString("utf8");
}

export async function releaseDelivery(ref: FirebaseFirestore.DocumentReference): Promise<"sent" | "skipped" | "retry" | "failed"> {
  const d = await claim(ref);
  if (!d) return "skipped";
  const owner = await db().collection("users").doc(d.get("ownerUid")).get();
  const postMortem = owner.get("status") === "DECEASED";
  const attempts = (d.get("attempts") ?? 0) as number;

  if (postMortem) {
    const later = nextQuietSafeTime(new Date());
    if (later) {
      await ref.update({ status: "PENDING", pendingDueAt: Timestamp.fromDate(later) });
      return "skipped";
    }
  }

  try {
    const code = await revealCode(d);
    let token: string;
    if (d.get("linkTokenSealed")) token = openStr(d.get("linkTokenSealed"), "token");
    else {
      token = randomToken();
      await ref.update({ linkTokenSealed: sealStr(token, "token"), linkTokenHash: sha256(token) });
    }
    const email = openStr(d.get("sealedEmail"));
    const name = openStr(d.get("sealedName"));
    const phone = openStr(d.get("sealedPhone"));
    const senderName = owner.get("displayName") ?? "Una persona a te cara";
    const codeBySms = !!(code && phone && smsEnabled());

    await sendTemplate(
      email,
      templates.delivery({
        recipientName: name,
        senderName,
        link: `${appUrl()}/r/${token}`,
        code: codeBySms ? undefined : (code ?? undefined),
        codeBySms,
        codeHint: d.get("codeHintSealed") ? openStr(d.get("codeHintSealed")) : undefined,
        postMortem,
      }),
      `delivery-${ref.id}`,
    );
    if (codeBySms) await sendSms(phone, `Secret Vault: il codice per il messaggio di ${senderName} è ${code}. Il link ti è arrivato via email.`);

    await ref.update({
      status: "SENT",
      sentAt: FieldValue.serverTimestamp(),
      pendingDueAt: null,
      attempts: attempts + 1,
      lastError: null,
      escrowSealed: FieldValue.delete(),
      // Kept only until the first opening, so the code can be re-sent if lost.
      ...(code ? { codeReserveSealed: sealStr(code, "escrow"), reserveExpiresAt: Timestamp.fromMillis(Date.now() + 90 * DAY) } : {}),
    });
    await audit(d.get("ownerUid"), "DELIVERY_SENT", { deliveryId: ref.id, postMortem });
    await recomputeMessageStatus(d.get("messageId"));
    return "sent";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tooEarly = /too early/i.test(msg);
    const next = attempts + 1;
    console.error("[delivery] failed", ref.id, msg);
    if (!tooEarly && next >= RETRY_MINUTES.length + 1) {
      await ref.update({ status: "FAILED", pendingDueAt: null, attempts: next, lastError: msg.slice(0, 200) });
      await audit(d.get("ownerUid"), "DELIVERY_FAILED", { deliveryId: ref.id });
      if (!postMortem && owner.get("email")) {
        await sendTemplate(owner.get("email"), templates.deliveryFailed({ name: owner.get("displayName"), recipient: d.get("emailMasked"), link: `${appUrl()}/app/messages/${d.get("messageId")}` })).catch(() => {});
      }
      await recomputeMessageStatus(d.get("messageId"));
      return "failed";
    }
    const delayMin = tooEarly ? 2 : RETRY_MINUTES[Math.min(attempts, RETRY_MINUTES.length - 1)];
    await ref.update({
      status: "PENDING",
      pendingDueAt: Timestamp.fromMillis(Date.now() + delayMin * 60_000),
      attempts: tooEarly ? attempts : next,
      lastError: msg.slice(0, 200),
    });
    return "retry";
  }
}

export async function sweepDueDeliveries(limit = 40) {
  const due = await db().collection("deliveries").where("pendingDueAt", "<=", Timestamp.now()).limit(limit).get();
  const results = { sent: 0, retry: 0, failed: 0, skipped: 0 };
  for (const doc of due.docs) results[await releaseDelivery(doc.ref)]++;
  return results;
}

// ------------------------------------------------------------------ digital will

export const DEFAULT_SWITCH: DeathSwitch = {
  enabled: false,
  intervalDays: 90,
  graceDays: 30,
  quorum: 1,
  contestHours: 72,
  allowUnattended: false,
  lastCheckinAt: null,
  nextDueAt: null,
};

export async function checkIn(uid: string) {
  const ref = db().collection("users").doc(uid);
  const u = await ref.get();
  const sw = { ...DEFAULT_SWITCH, ...(u.get("deathSwitch") ?? {}) };
  await ref.update({
    "deathSwitch.lastCheckinAt": Timestamp.now(),
    "deathSwitch.nextDueAt": sw.enabled ? Timestamp.fromMillis(Date.now() + sw.intervalDays * DAY) : null,
    remindersSent: 0,
  });
}

export async function openCaseFor(uid: string) {
  const s = await db().collection("deathCases").where("ownerUid", "==", uid).get();
  return s.docs.find((d) => ["AWAITING_EXECUTORS", "CONTEST", "NEEDS_REVIEW"].includes(d.get("status"))) ?? null;
}

export async function acceptedExecutors(uid: string) {
  const s = await db().collection("executors").where("ownerUid", "==", uid).get();
  return s.docs.filter((d) => d.get("status") === "ACCEPTED");
}

export const effectiveQuorum = (quorum: number, accepted: number) => Math.max(1, Math.min(quorum, accepted));

const cancelLink = (uid: string) => `${appUrl()}/checkin?t=${signToken({ uid, p: "checkin" }, 30 * 86400)}`;
const fmtDate = (d: Date) => new Intl.DateTimeFormat("it-IT", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Rome" }).format(d);

async function startContest(caseRef: FirebaseFirestore.DocumentReference, ownerUid: string, hours: number) {
  const until = new Date(Date.now() + hours * 3_600_000);
  await caseRef.update({ status: "CONTEST", contestUntil: Timestamp.fromDate(until) });
  const owner = await db().collection("users").doc(ownerUid).get();
  await sendTemplate(owner.get("email"), templates.caseOpened({ name: owner.get("displayName"), link: cancelLink(ownerUid), contestUntil: fmtDate(until) })).catch(() => {});
  await audit(ownerUid, "DEATH_CASE_CONTEST", { caseId: caseRef.id, hours });
}

export async function openDeathCase(uid: string, reason: string) {
  if (await openCaseFor(uid)) return;
  const owner = await db().collection("users").doc(uid).get();
  const sw: DeathSwitch = { ...DEFAULT_SWITCH, ...(owner.get("deathSwitch") ?? {}) };
  const execs = await acceptedExecutors(uid);
  const ref = await db().collection("deathCases").add({ ownerUid: uid, reason, status: "AWAITING_EXECUTORS", decisions: {}, openedAt: FieldValue.serverTimestamp() });
  await audit(uid, "DEATH_CASE_OPENED", { caseId: ref.id, reason });

  // The owner is always warned first: they might simply be away.
  await sendTemplate(owner.get("email"), templates.caseOpened({ name: owner.get("displayName"), link: cancelLink(uid) })).catch(() => {});

  if (execs.length > 0) {
    for (const e of execs) {
      await sendTemplate(
        openStr(e.get("sealedEmail")),
        templates.executorCase({ executorName: openStr(e.get("sealedName")), ownerName: owner.get("displayName"), link: `${appUrl()}/app/trust` }),
      ).catch((err) => console.error("[case] executor email", err));
    }
  } else if (sw.allowUnattended && reason === "CHECKIN_MISSED") {
    await startContest(ref, uid, 14 * 24); // no executors: a much longer waiting period
  } else {
    await ref.update({ status: "NEEDS_REVIEW" });
  }
}

export async function recordExecutorDecision(caseId: string, executorId: string, decision: "CONFIRM" | "DENY") {
  const ref = db().collection("deathCases").doc(caseId);
  const c = await ref.get();
  if (c.get("status") !== "AWAITING_EXECUTORS") return c.get("status");
  await ref.update({ [`decisions.${executorId}`]: decision });
  const decisions = { ...(c.get("decisions") ?? {}), [executorId]: decision } as Record<string, string>;
  const owner = await db().collection("users").doc(c.get("ownerUid")).get();
  const sw: DeathSwitch = { ...DEFAULT_SWITCH, ...(owner.get("deathSwitch") ?? {}) };
  const accepted = (await acceptedExecutors(c.get("ownerUid"))).length;
  const q = effectiveQuorum(sw.quorum, accepted);
  const confirms = Object.values(decisions).filter((d) => d === "CONFIRM").length;
  const denies = Object.values(decisions).filter((d) => d === "DENY").length;
  await audit(c.get("ownerUid"), "EXECUTOR_DECISION", { caseId, decision });
  if (confirms >= q) {
    await startContest(ref, c.get("ownerUid"), sw.contestHours);
    return "CONTEST";
  }
  if (denies > accepted - q) {
    await ref.update({ status: "REJECTED", closedAt: FieldValue.serverTimestamp() });
    await checkIn(c.get("ownerUid"));
    return "REJECTED";
  }
  return "AWAITING_EXECUTORS";
}

export async function cancelOpenCase(uid: string, by: string) {
  const c = await openCaseFor(uid);
  if (c) {
    await c.ref.update({ status: "CANCELLED", closedAt: FieldValue.serverTimestamp(), cancelledBy: by });
    await audit(uid, "DEATH_CASE_CANCELLED", { caseId: c.id, by });
  }
  await checkIn(uid);
}

async function confirmDeath(caseDoc: DocumentSnapshot) {
  const uid = caseDoc.get("ownerUid") as string;
  await caseDoc.ref.update({ status: "CONFIRMED", closedAt: FieldValue.serverTimestamp() });
  await db().collection("users").doc(uid).update({ status: "DECEASED", "deathSwitch.enabled": false, "deathSwitch.nextDueAt": null });
  await audit(uid, "DEATH_CONFIRMED", { caseId: caseDoc.id });

  const msgs = await db().collection("messages").where("ownerUid", "==", uid).get();
  const armed = msgs.docs.filter((m) => m.get("status") === "ARMED" && ["DEATH", "DATE_OR_DEATH"].includes(m.get("trigger")?.kind));
  for (const m of armed) {
    const ds = await db().collection("deliveries").where("messageId", "==", m.id).get();
    const batch = db().batch();
    for (const d of ds.docs) {
      if (["WAITING", "PENDING"].includes(d.get("status"))) batch.update(d.ref, { status: "PENDING", pendingDueAt: Timestamp.now() });
    }
    batch.update(m.ref, { status: "SCHEDULED", updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
  }
  const owner = await db().collection("users").doc(uid).get();
  for (const e of await acceptedExecutors(uid)) {
    await sendTemplate(openStr(e.get("sealedEmail")), templates.executorsInformed({ executorName: openStr(e.get("sealedName")), ownerName: owner.get("displayName") })).catch(() => {});
  }
}

export async function deathCaseTick() {
  const due = await db().collection("deathCases").where("contestUntil", "<=", Timestamp.now()).get();
  let confirmed = 0;
  for (const c of due.docs) {
    if (c.get("status") !== "CONTEST") continue;
    await confirmDeath(c);
    confirmed++;
  }
  return confirmed;
}

export async function deadManSwitchTick() {
  const due = await db().collection("users").where("deathSwitch.nextDueAt", "<=", Timestamp.now()).get();
  let reminders = 0, cases = 0;
  for (const u of due.docs) {
    const sw: DeathSwitch & { nextDueAt: Timestamp } = { ...DEFAULT_SWITCH, ...u.get("deathSwitch") };
    if (!sw.enabled || u.get("status") === "DECEASED") continue;
    const overdueDays = (Date.now() - sw.nextDueAt.toMillis()) / DAY;
    if (overdueDays < sw.graceDays) {
      const step = Math.floor(overdueDays / 7);
      const sent = (u.get("remindersSent") ?? 0) as number;
      if (step >= sent) {
        const final = step + 1 >= Math.ceil(sw.graceDays / 7);
        await sendTemplate(u.get("email"), templates.checkinReminder({ name: u.get("displayName"), link: cancelLink(u.id), final })).catch((e) => console.error(e));
        await u.ref.update({ remindersSent: step + 1 });
        reminders++;
      }
    } else if (!(await openCaseFor(u.id))) {
      await openDeathCase(u.id, "CHECKIN_MISSED");
      cases++;
    }
  }
  return { reminders, cases };
}

// ------------------------------------------------------------------ maintenance

/** Escrowed codes are kept only 90 days after sending, to allow "send me the code again". */
async function purgeExpiredCodeReserves() {
  const s = await db().collection("deliveries").where("reserveExpiresAt", "<=", Timestamp.now()).limit(200).get();
  for (const d of s.docs) await d.ref.update({ codeReserveSealed: FieldValue.delete(), reserveExpiresAt: FieldValue.delete() });
  return s.size;
}

/** Runs all periodic jobs. Guarded by a short lease so concurrent invocations don't overlap. */
export async function runMaintenance(opts: { minIntervalMs?: number } = {}) {
  const lockRef = db().collection("meta").doc("maintenance");
  const acquired = await db().runTransaction(async (tx) => {
    const s = await tx.get(lockRef);
    const now = Date.now();
    if ((s.get("lockUntil")?.toMillis?.() ?? 0) > now) return false;
    if (opts.minIntervalMs && now - (s.get("lastRunAt")?.toMillis?.() ?? 0) < opts.minIntervalMs) return false;
    tx.set(lockRef, { lockUntil: Timestamp.fromMillis(now + 4 * 60_000), lastRunAt: Timestamp.fromMillis(now) }, { merge: true });
    return true;
  });
  if (!acquired) return { skipped: true };
  try {
    const switches = await deadManSwitchTick();
    const confirmed = await deathCaseTick();
    const deliveries = await sweepDueDeliveries();
    const purgedCodes = await purgeExpiredCodeReserves();
    return { switches, confirmed, deliveries, purgedCodes };
  } finally {
    await lockRef.set({ lockUntil: Timestamp.fromMillis(0) }, { merge: true });
  }
}
