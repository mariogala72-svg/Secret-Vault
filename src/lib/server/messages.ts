import "server-only";
import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";
import { DEFAULT_SWITCH, acceptedExecutors, initialStatuses } from "./engine";
import { db } from "./firebase";
import { HttpError, iso } from "./http";
import { emailIndex, maskEmail, normalizeEmail, openStr, sealStr } from "./seal";
import type { DeliveryView, MessageInput, MessageView } from "../types";

const b64 = (max: number) => z.string().max(max).regex(/^[A-Za-z0-9+/=]*$/);
const id = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);

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

export async function assertTriggerAllowed(uid: string, input: MessageInput) {
  const t = input.trigger;
  if (input.intent === "draft") return;
  if (input.deliveries.length === 0) throw new HttpError(400, "Aggiungi almeno un destinatario");
  if (t.fireAt && ["FIXED_DATE", "DATE_OR_DEATH"].includes(t.kind) && new Date(t.fireAt).getTime() < Date.now() - 60_000) {
    throw new HttpError(400, "La data di invio deve essere nel futuro");
  }
  if (t.kind === "DEATH" || t.kind === "DATE_OR_DEATH") {
    const u = await db().collection("users").doc(uid).get();
    const sw = { ...DEFAULT_SWITCH, ...(u.get("deathSwitch") ?? {}) };
    const execs = await acceptedExecutors(uid);
    if (!sw.enabled || (execs.length === 0 && !sw.allowUnattended)) {
      throw new HttpError(400, "Per questa opzione attiva prima il testamento digitale con almeno una persona di fiducia", "WILL_NOT_READY");
    }
  }
  for (const d of input.deliveries) {
    if (d.keyMode === "ESCROW_TLOCK" && t.kind !== "FIXED_DATE") throw new HttpError(400, "Modalità di consegna non coerente con la data");
    if (d.keyMode !== "SENDER_SHARES_CODE" && !d.escrow && !d.keepId) throw new HttpError(400, "Codice mancante");
  }
}

export function deliveryDoc(uid: string, messageId: string, d: MessageInput["deliveries"][number], st: ReturnType<typeof initialStatuses>) {
  const email = normalizeEmail(d.email);
  return {
    messageId,
    ownerUid: uid,
    contactId: d.contactId,
    sealedName: sealStr(d.name),
    sealedEmail: sealStr(email),
    sealedPhone: d.phone ? sealStr(d.phone) : null,
    emailIdx: emailIndex(email),
    emailMasked: maskEmail(email),
    keyMode: d.keyMode,
    wrappedDek: d.wrappedDek,
    codeSalt: d.codeSalt,
    escrowSealed: d.escrow ? sealStr(d.escrow, "escrow") : null,
    codeHintSealed: d.codeHint ? sealStr(d.codeHint) : null,
    status: st.delivery,
    pendingDueAt: st.delivery === "PENDING" && st.dueAt ? Timestamp.fromDate(st.dueAt) : null,
    dueAt: st.dueAt ? Timestamp.fromDate(st.dueAt) : null,
    attempts: 0,
    failedCodeAttempts: 0,
    createdAt: FieldValue.serverTimestamp(),
  };
}

export function deliveryView(d: DocumentSnapshot): DeliveryView {
  return {
    id: d.id,
    contactId: d.get("contactId"),
    name: openStr(d.get("sealedName")),
    emailMasked: d.get("emailMasked"),
    keyMode: d.get("keyMode"),
    status: d.get("status"),
    dueAt: iso(d.get("dueAt")),
    sentAt: iso(d.get("sentAt")),
    openedAt: iso(d.get("openedAt")),
    lastError: d.get("status") === "FAILED" || d.get("attempts") > 0 ? (d.get("lastError") ?? null) : null,
  };
}

export function messageView(m: DocumentSnapshot, deliveries: DocumentSnapshot[], withBody = false): MessageView {
  return {
    id: m.id,
    status: m.get("status"),
    encTitle: m.get("encTitle"),
    ...(withBody ? { encBody: m.get("encBody") } : {}),
    ownerWrappedDek: m.get("ownerWrappedDek"),
    attachments: m.get("attachments") ?? [],
    trigger: m.get("trigger"),
    createdAt: iso(m.get("createdAt"))!,
    updatedAt: iso(m.get("updatedAt"))!,
    deliveries: deliveries.map(deliveryView),
  };
}

export async function getOwnedMessage(uid: string, messageId: string) {
  const m = await db().collection("messages").doc(messageId).get();
  if (!m.exists || m.get("ownerUid") !== uid) throw new HttpError(404, "Messaggio non trovato");
  return m;
}

export async function deleteChunks(messageId: string, keepAttachmentIds: string[] = []) {
  const s = await db().collection("chunks").where("messageId", "==", messageId).select("aid").get();
  const toDelete = s.docs.filter((d) => !keepAttachmentIds.includes(d.get("aid")));
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db().batch();
    toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function assertChunksUploaded(uid: string, messageId: string, attachments: MessageInput["attachments"]) {
  if (!attachments.length) return;
  const s = await db().collection("chunks").where("messageId", "==", messageId).select("aid", "ownerUid").get();
  const counts = new Map<string, number>();
  for (const d of s.docs) {
    if (d.get("ownerUid") !== uid) throw new HttpError(403, "Allegato non valido");
    counts.set(d.get("aid"), (counts.get(d.get("aid")) ?? 0) + 1);
  }
  for (const a of attachments) if ((counts.get(a.id) ?? 0) < a.chunkCount) throw new HttpError(400, "Caricamento allegati incompleto, riprova");
}
