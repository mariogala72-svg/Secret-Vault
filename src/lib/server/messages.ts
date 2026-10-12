import "server-only";
import { z } from "zod";
import { sql, type Row } from "./db";
import { acceptedExecutors, initialStatuses } from "./engine";
import { HttpError, iso } from "./http";
import { emailIndex, maskEmail, normalizeEmail, openStr, sealStr } from "./seal";
import type { DeliveryView, MessageInput, MessageView } from "../types";

const b64 = (max: number) => z.string().max(max).regex(/^[A-Za-z0-9+/=]*$/);
const id = z.string().uuid();

export const TriggerSchema = z
  .object({
    kind: z.enum(["FIXED_DATE", "MANUAL_NOW", "MANUAL_LATER", "DEATH", "DATE_OR_DEATH"]),
    fireAt: z.string().datetime().nullish(),
    occasion: z.enum(["BIRTHDAY", "ANNIVERSARY", "WEDDING", "COMING_OF_AGE", "OTHER"]).nullish(),
  })
  .refine((t) => !["FIXED_DATE", "DATE_OR_DEATH"].includes(t.kind) || !!t.fireAt, { message: "Data richiesta" });

const DeliverySchema = z.object({
  keepId: id.optional(),
  contactId: id,
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  keyMode: z.enum(["SENDER_SHARES_CODE", "ESCROW_TLOCK", "ESCROW_SERVER"]),
  wrappedDek: b64(500),
  codeSalt: b64(100),
  escrow: z.string().max(4000).optional(),
  codeHint: z.string().max(300).optional(),
});

export const MessageSchema = z.object({
  id,
  intent: z.enum(["draft", "schedule"]),
  encTitle: b64(2_000),
  encBody: b64(700_000),
  ownerWrappedDek: b64(1_000),
  attachments: z.array(z.object({ id, encMeta: b64(2_000), size: z.number().int().min(0).max(25 * 1024 * 1024), chunkCount: z.number().int().min(1).max(64) })).max(10),
  trigger: TriggerSchema,
  deliveries: z.array(DeliverySchema).max(10),
});

export const triggerJson = (t: MessageInput["trigger"]) => ({ kind: t.kind, fireAt: t.fireAt ?? null, occasion: t.occasion ?? null });

export async function assertTriggerAllowed(uid: string, input: MessageInput) {
  const t = input.trigger;
  if (input.intent === "draft") return;
  if (input.deliveries.length === 0) throw new HttpError(400, "Aggiungi almeno un destinatario");
  if (t.fireAt && ["FIXED_DATE", "DATE_OR_DEATH"].includes(t.kind) && new Date(t.fireAt).getTime() < Date.now() - 60_000) {
    throw new HttpError(400, "La data di invio deve essere nel futuro");
  }
  if (t.kind === "DEATH" || t.kind === "DATE_OR_DEATH") {
    const [u] = await sql()`select ds_enabled, ds_allow_unattended from users where id = ${uid}`;
    const execs = await acceptedExecutors(uid);
    if (!u.ds_enabled || (execs.length === 0 && !u.ds_allow_unattended)) {
      throw new HttpError(400, "Per questa opzione attiva prima il testamento digitale con almeno una persona di fiducia", "WILL_NOT_READY");
    }
  }
  for (const d of input.deliveries) {
    if (d.keyMode === "ESCROW_TLOCK" && t.kind !== "FIXED_DATE") throw new HttpError(400, "Modalità di consegna non coerente con la data");
    if (d.keyMode !== "SENDER_SHARES_CODE" && !d.escrow && !d.keepId) throw new HttpError(400, "Codice mancante");
  }
}

export function deliveryRow(uid: string, messageId: string, d: MessageInput["deliveries"][number], st: ReturnType<typeof initialStatuses>) {
  const email = normalizeEmail(d.email);
  return {
    message_id: messageId,
    owner_id: uid,
    contact_id: d.contactId,
    sealed_name: sealStr(d.name),
    sealed_email: sealStr(email),
    sealed_phone: d.phone ? sealStr(d.phone) : null,
    email_idx: emailIndex(email),
    email_masked: maskEmail(email),
    key_mode: d.keyMode,
    wrapped_dek: d.wrappedDek,
    code_salt: d.codeSalt,
    escrow_sealed: d.escrow ? sealStr(d.escrow, "escrow") : null,
    code_hint_sealed: d.codeHint ? sealStr(d.codeHint) : null,
    status: st.delivery,
    pending_due_at: st.delivery === "PENDING" ? st.dueAt : null,
    due_at: st.dueAt,
  };
}

export function deliveryView(d: Row): DeliveryView {
  return {
    id: d.id as string,
    contactId: d.contact_id as string,
    name: openStr(d.sealed_name as string),
    emailMasked: d.email_masked as string,
    keyMode: d.key_mode as DeliveryView["keyMode"],
    status: d.status as DeliveryView["status"],
    dueAt: iso(d.due_at),
    sentAt: iso(d.sent_at),
    openedAt: iso(d.opened_at),
    lastError: d.status === "FAILED" || (d.attempts as number) > 0 ? ((d.last_error as string) ?? null) : null,
  };
}

export function messageView(m: Row, deliveries: Row[], withBody = false): MessageView {
  return {
    id: m.id as string,
    status: m.status as MessageView["status"],
    encTitle: m.enc_title as string,
    ...(withBody ? { encBody: m.enc_body as string } : {}),
    ownerWrappedDek: m.owner_wrapped_dek as string,
    attachments: (m.attachments as MessageView["attachments"]) ?? [],
    trigger: m.trigger as MessageView["trigger"],
    createdAt: iso(m.created_at)!,
    updatedAt: iso(m.updated_at)!,
    deliveries: deliveries.map(deliveryView),
  };
}

export async function getOwnedMessage(uid: string, messageId: string): Promise<Row> {
  if (!z.string().uuid().safeParse(messageId).success) throw new HttpError(404, "Messaggio non trovato");
  const [m] = await sql()`select * from messages where id = ${messageId} and owner_id = ${uid}`;
  if (!m) throw new HttpError(404, "Messaggio non trovato");
  return m;
}

export async function deleteChunks(messageId: string, keepAttachmentIds: string[] = []) {
  if (keepAttachmentIds.length) await sql()`delete from chunks where message_id = ${messageId} and aid <> all(${keepAttachmentIds}::uuid[])`;
  else await sql()`delete from chunks where message_id = ${messageId}`;
}

export async function assertChunksUploaded(uid: string, messageId: string, attachments: MessageInput["attachments"]) {
  if (!attachments.length) return;
  const rows = await sql()`select aid, owner_id, count(*)::int as n from chunks where message_id = ${messageId} group by aid, owner_id`;
  if (rows.some((r) => r.owner_id !== uid)) throw new HttpError(403, "Allegato non valido");
  for (const a of attachments) {
    if ((rows.find((r) => r.aid === a.id)?.n ?? 0) < a.chunkCount) throw new HttpError(400, "Caricamento allegati incompleto, riprova");
  }
}
