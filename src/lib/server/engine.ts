import "server-only";
import { mainnetClient, timelockDecrypt } from "tlock-js";
import { audit } from "./audit";
import { sql, type Row } from "./db";
import { sendTemplate, templates } from "./email";
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
  const ds = await sql()`select status from deliveries where message_id = ${messageId}`;
  if (!ds.length) return;
  const st = ds.map((d) => d.status as DeliveryStatus);
  const done = st.filter((s) => s === "SENT" || s === "OPENED").length;
  const failed = st.filter((s) => s === "FAILED").length;
  let status: MessageStatus | null = null;
  if (done === st.length) status = "DELIVERED";
  else if (done + failed === st.length) status = done > 0 ? "PARTIAL" : "FAILED";
  if (status) await sql()`update messages set status = ${status}, updated_at = now() where id = ${messageId} and status <> ${status}`;
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

/** Atomically takes a lease on a due delivery, so concurrent runs never send twice. */
async function claim(id: string): Promise<Row | null> {
  const [d] = await sql()`
    update deliveries set status = 'SENDING', pending_due_at = ${new Date(Date.now() + LEASE_MS)}
    where id = ${id} and status in ('PENDING', 'SENDING') and pending_due_at <= now()
    returning *`;
  return d ?? null;
}

async function revealCode(d: Row): Promise<string | null> {
  if (d.key_mode === "SENDER_SHARES_CODE") return null;
  if (d.code_reserve_sealed) return openStr(d.code_reserve_sealed as string, "escrow");
  const escrow = openStr(d.escrow_sealed as string, "escrow");
  if (d.key_mode === "ESCROW_SERVER") return escrow;
  // ESCROW_TLOCK: only openable once the drand network has published the round for the delivery date.
  return (await timelockDecrypt(escrow, mainnetClient())).toString("utf8");
}

export async function releaseDelivery(id: string): Promise<"sent" | "skipped" | "retry" | "failed"> {
  const d = await claim(id);
  if (!d) return "skipped";
  const [owner] = await sql()`select id, email, display_name, status from users where id = ${d.owner_id}`;
  const postMortem = owner.status === "DECEASED";
  const attempts = d.attempts as number;

  if (postMortem) {
    const later = nextQuietSafeTime(new Date());
    if (later) {
      await sql()`update deliveries set status = 'PENDING', pending_due_at = ${later} where id = ${id}`;
      return "skipped";
    }
  }

  try {
    const code = await revealCode(d);
    let token: string;
    if (d.link_token_sealed) token = openStr(d.link_token_sealed as string, "token");
    else {
      token = randomToken();
      await sql()`update deliveries set link_token_sealed = ${sealStr(token, "token")}, link_token_hash = ${sha256(token)} where id = ${id}`;
    }
    const phone = openStr(d.sealed_phone as string | null);
    const senderName = (owner.display_name as string) ?? "Una persona a te cara";
    const codeBySms = !!(code && phone && smsEnabled());

    await sendTemplate(
      openStr(d.sealed_email as string),
      templates.delivery({
        recipientName: openStr(d.sealed_name as string),
        senderName,
        link: `${appUrl()}/r/${token}`,
        code: codeBySms ? undefined : (code ?? undefined),
        codeBySms,
        codeHint: d.code_hint_sealed ? openStr(d.code_hint_sealed as string) : undefined,
        postMortem,
      }),
      `delivery-${id}`,
    );
    if (codeBySms) await sendSms(phone, `Secret Vault: il codice per il messaggio di ${senderName} è ${code}. Il link ti è arrivato via email.`);

    // The escrowed code is destroyed; a sealed copy is kept 90 days only to allow "send me the code again".
    await sql()`
      update deliveries set
        status = 'SENT', sent_at = now(), pending_due_at = null, attempts = ${attempts + 1}, last_error = null,
        escrow_sealed = null,
        code_reserve_sealed = ${code ? sealStr(code, "escrow") : null},
        reserve_expires_at = ${code ? new Date(Date.now() + 90 * DAY) : null}
      where id = ${id}`;
    await audit(d.owner_id as string, "DELIVERY_SENT", { deliveryId: id, postMortem });
    await recomputeMessageStatus(d.message_id as string);
    return "sent";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tooEarly = /too early/i.test(msg);
    const next = attempts + 1;
    console.error("[delivery] failed", id, msg);
    if (!tooEarly && next >= RETRY_MINUTES.length + 1) {
      await sql()`update deliveries set status = 'FAILED', pending_due_at = null, attempts = ${next}, last_error = ${msg.slice(0, 200)} where id = ${id}`;
      await audit(d.owner_id as string, "DELIVERY_FAILED", { deliveryId: id });
      if (!postMortem) {
        await sendTemplate(owner.email, templates.deliveryFailed({ name: owner.display_name, recipient: d.email_masked as string, link: `${appUrl()}/app/messages/${d.message_id}` })).catch(() => {});
      }
      await recomputeMessageStatus(d.message_id as string);
      return "failed";
    }
    const delayMin = tooEarly ? 2 : RETRY_MINUTES[Math.min(attempts, RETRY_MINUTES.length - 1)];
    await sql()`
      update deliveries set status = 'PENDING', pending_due_at = ${new Date(Date.now() + delayMin * 60_000)},
        attempts = ${tooEarly ? attempts : next}, last_error = ${msg.slice(0, 200)}
      where id = ${id}`;
    return "retry";
  }
}

export async function sweepDueDeliveries(limit = 40) {
  const due = await sql()`select id from deliveries where pending_due_at <= now() order by pending_due_at limit ${limit}`;
  const results = { sent: 0, retry: 0, failed: 0, skipped: 0 };
  for (const d of due) results[await releaseDelivery(d.id)]++;
  return results;
}

// ------------------------------------------------------------------ digital will

export function switchOf(u: Row): DeathSwitch {
  return {
    enabled: u.ds_enabled as boolean,
    intervalDays: u.ds_interval_days as number,
    graceDays: u.ds_grace_days as number,
    quorum: u.ds_quorum as number,
    contestHours: u.ds_contest_hours as number,
    allowUnattended: u.ds_allow_unattended as boolean,
    lastCheckinAt: u.ds_last_checkin_at ? new Date(u.ds_last_checkin_at as string).toISOString() : null,
    nextDueAt: u.ds_next_due_at ? new Date(u.ds_next_due_at as string).toISOString() : null,
  };
}

export async function checkIn(uid: string) {
  await sql()`
    update users set
      ds_last_checkin_at = now(),
      ds_next_due_at = case when ds_enabled then now() + make_interval(days => ds_interval_days) else null end,
      ds_reminders_sent = 0
    where id = ${uid}`;
}

export async function openCaseFor(uid: string): Promise<Row | null> {
  const [c] = await sql()`select * from death_cases where owner_id = ${uid} and status in ('AWAITING_EXECUTORS', 'CONTEST', 'NEEDS_REVIEW')`;
  return c ?? null;
}

export async function acceptedExecutors(uid: string) {
  return sql()`select * from executors where owner_id = ${uid} and status = 'ACCEPTED'`;
}

export const effectiveQuorum = (quorum: number, accepted: number) => Math.max(1, Math.min(quorum, accepted));

const cancelLink = (uid: string) => `${appUrl()}/checkin?t=${signToken({ uid, p: "checkin" }, 30 * 86400)}`;
const fmtDate = (d: Date) => new Intl.DateTimeFormat("it-IT", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Rome" }).format(d);

async function startContest(caseId: string, ownerId: string, hours: number) {
  const until = new Date(Date.now() + hours * 3_600_000);
  await sql()`update death_cases set status = 'CONTEST', contest_until = ${until} where id = ${caseId}`;
  const [owner] = await sql()`select email, display_name from users where id = ${ownerId}`;
  await sendTemplate(owner.email, templates.caseOpened({ name: owner.display_name, link: cancelLink(ownerId), contestUntil: fmtDate(until) })).catch(() => {});
  await audit(ownerId, "DEATH_CASE_CONTEST", { caseId, hours });
}

export async function openDeathCase(uid: string, reason: string) {
  if (await openCaseFor(uid)) return;
  const [owner] = await sql()`select * from users where id = ${uid}`;
  const sw = switchOf(owner);
  const execs = await acceptedExecutors(uid);
  const [c] = await sql()`
    insert into death_cases (owner_id, reason, status) values (${uid}, ${reason}, 'AWAITING_EXECUTORS')
    on conflict do nothing returning id`;
  if (!c) return;
  await audit(uid, "DEATH_CASE_OPENED", { caseId: c.id, reason });

  // The owner is always warned first: they might simply be away.
  await sendTemplate(owner.email, templates.caseOpened({ name: owner.display_name, link: cancelLink(uid) })).catch(() => {});

  if (execs.length > 0) {
    for (const e of execs) {
      await sendTemplate(
        openStr(e.sealed_email),
        templates.executorCase({ executorName: openStr(e.sealed_name), ownerName: owner.display_name, link: `${appUrl()}/app/trust` }),
      ).catch((err) => console.error("[case] executor email", err));
    }
  } else if (sw.allowUnattended && reason === "CHECKIN_MISSED") {
    await startContest(c.id, uid, 14 * 24); // no executors: a much longer waiting period
  } else {
    await sql()`update death_cases set status = 'NEEDS_REVIEW' where id = ${c.id}`;
  }
}

export async function recordExecutorDecision(caseId: string, executorId: string, decision: "CONFIRM" | "DENY") {
  const [c] = await sql()`
    update death_cases set decisions = decisions || ${sql().json({ [executorId]: decision })}
    where id = ${caseId} and status = 'AWAITING_EXECUTORS'
    returning *`;
  if (!c) {
    const [cur] = await sql()`select status from death_cases where id = ${caseId}`;
    return cur?.status ?? null;
  }
  const [owner] = await sql()`select * from users where id = ${c.owner_id}`;
  const sw = switchOf(owner);
  const accepted = (await acceptedExecutors(c.owner_id)).length;
  const q = effectiveQuorum(sw.quorum, accepted);
  const values = Object.values(c.decisions as Record<string, string>);
  const confirms = values.filter((d) => d === "CONFIRM").length;
  const denies = values.filter((d) => d === "DENY").length;
  await audit(c.owner_id, "EXECUTOR_DECISION", { caseId, decision });
  if (confirms >= q) {
    await startContest(caseId, c.owner_id, sw.contestHours);
    return "CONTEST";
  }
  if (denies > accepted - q) {
    await sql()`update death_cases set status = 'REJECTED', closed_at = now() where id = ${caseId}`;
    await checkIn(c.owner_id);
    return "REJECTED";
  }
  return "AWAITING_EXECUTORS";
}

export async function cancelOpenCase(uid: string, by: string) {
  const c = await openCaseFor(uid);
  if (c) {
    await sql()`update death_cases set status = 'CANCELLED', closed_at = now(), cancelled_by = ${by} where id = ${c.id}`;
    await audit(uid, "DEATH_CASE_CANCELLED", { caseId: c.id as string, by });
  }
  await checkIn(uid);
}

async function confirmDeath(c: Row) {
  const uid = c.owner_id as string;
  await sql().begin(async (tx) => {
    await tx`update death_cases set status = 'CONFIRMED', closed_at = now() where id = ${c.id as string}`;
    await tx`update users set status = 'DECEASED', ds_enabled = false, ds_next_due_at = null where id = ${uid}`;
    // Every delivery of an armed post-mortem message becomes due now.
    await tx`
      update deliveries d set status = 'PENDING', pending_due_at = now()
      from messages m
      where d.message_id = m.id and m.owner_id = ${uid} and m.status = 'ARMED'
        and m.trigger->>'kind' in ('DEATH', 'DATE_OR_DEATH') and d.status in ('WAITING', 'PENDING')`;
    await tx`
      update messages set status = 'SCHEDULED', updated_at = now()
      where owner_id = ${uid} and status = 'ARMED' and trigger->>'kind' in ('DEATH', 'DATE_OR_DEATH')`;
  });
  await audit(uid, "DEATH_CONFIRMED", { caseId: c.id as string });
  const [owner] = await sql()`select display_name from users where id = ${uid}`;
  for (const e of await acceptedExecutors(uid)) {
    await sendTemplate(openStr(e.sealed_email), templates.executorsInformed({ executorName: openStr(e.sealed_name), ownerName: owner.display_name })).catch(() => {});
  }
}

export async function deathCaseTick() {
  const due = await sql()`select * from death_cases where status = 'CONTEST' and contest_until <= now()`;
  for (const c of due) await confirmDeath(c);
  return due.length;
}

export async function deadManSwitchTick() {
  const due = await sql()`select * from users where ds_enabled and status = 'ACTIVE' and ds_next_due_at <= now()`;
  let reminders = 0, cases = 0;
  for (const u of due) {
    const overdueDays = (Date.now() - new Date(u.ds_next_due_at).getTime()) / DAY;
    if (overdueDays < u.ds_grace_days) {
      const step = Math.floor(overdueDays / 7);
      if (step >= u.ds_reminders_sent) {
        const final = step + 1 >= Math.ceil(u.ds_grace_days / 7);
        await sendTemplate(u.email, templates.checkinReminder({ name: u.display_name, link: cancelLink(u.id), final })).catch((e) => console.error(e));
        await sql()`update users set ds_reminders_sent = ${step + 1} where id = ${u.id}`;
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

async function cleanup() {
  const purged = await sql()`
    update deliveries set code_reserve_sealed = null, reserve_expires_at = null
    where reserve_expires_at <= now() returning id`;
  await sql()`delete from sessions where expires_at < now()`;
  await sql()`delete from auth_tokens where expires_at < now() - interval '1 day'`;
  // Attachment chunks uploaded for messages that were never saved.
  await sql()`
    delete from chunks c where c.created_at < now() - interval '1 day'
      and not exists (select 1 from messages m where m.id = c.message_id)`;
  return purged.length;
}

/** Runs all periodic jobs. Guarded by a short lease so concurrent invocations don't overlap. */
export async function runMaintenance(opts: { minIntervalMs?: number } = {}) {
  const minInterval = `${Math.floor((opts.minIntervalMs ?? 0) / 1000)} seconds`;
  const [lock] = await sql()`
    update app_meta set lock_until = now() + interval '4 minutes', last_run_at = now()
    where key = 'maintenance' and lock_until < now() and last_run_at < now() - ${minInterval}::interval
    returning key`;
  if (!lock) return { skipped: true };
  try {
    const switches = await deadManSwitchTick();
    const confirmed = await deathCaseTick();
    const deliveries = await sweepDueDeliveries();
    const purgedCodes = await cleanup();
    return { switches, confirmed, deliveries, purgedCodes };
  } finally {
    await sql()`update app_meta set lock_until = 'epoch' where key = 'maintenance'`;
  }
}
