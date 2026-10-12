import { Buffer, defaultChainInfo, roundAt, timelockEncrypt, type ChainClient } from "tlock-js";
import { generateAccessCode, normalizeCode } from "./code";
import { fromB64, randomBytes, td, te, toB64, wipe } from "./encoding";
import { CODE_KDF, deriveKey, hkdf, open, openWithPrivateKey, seal, sealToPublicKey } from "./primitives";
import type { DeliveryInput, KeyMode, Trigger } from "../types";

export const CHUNK_SIZE = 512 * 1024; // plaintext bytes per encrypted chunk
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_MESSAGE_BYTES = 40 * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];

export const aad = {
  title: (mid: string) => `sv:v1:message:${mid}:title`,
  body: (mid: string) => `sv:v1:message:${mid}:body`,
  ownerDek: (mid: string) => `sv:v1:message:${mid}:owner-dek`,
  attMeta: (aid: string) => `sv:v1:attachment:${aid}:meta`,
  chunk: (aid: string, n: number) => `sv:v1:attachment:${aid}:chunk:${n}`,
  recipientDek: (mid: string) => `sv:v1:delivery:${mid}:dek`,
  contact: (uid: string, cid: string) => `sv:v1:contact:${uid}:${cid}`,
};

export const newDek = () => randomBytes(32);

export async function encryptText(dek: Uint8Array<ArrayBuffer>, text: string, ad: string) {
  return toB64(await seal(dek, te.encode(text), ad));
}
export async function decryptText(dek: Uint8Array<ArrayBuffer>, b64: string, ad: string) {
  return td.decode(await open(dek, fromB64(b64), ad));
}

export async function wrapDekForOwner(dek: Uint8Array<ArrayBuffer>, ownerPublicKey: Uint8Array<ArrayBuffer>, mid: string) {
  return toB64(await sealToPublicKey(ownerPublicKey, dek, aad.ownerDek(mid)));
}
export async function unwrapOwnerDek(privateKey: Uint8Array<ArrayBuffer>, b64: string, mid: string) {
  return openWithPrivateKey(privateKey, fromB64(b64), aad.ownerDek(mid));
}

// ---------- Attachments ----------

export function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Checks the real file signature, not just the extension. */
export async function validateFile(file: File): Promise<string | null> {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXT.includes(ext)) return "Formato non supportato (PDF, Word, JPG, PNG)";
  if (file.size > MAX_FILE_BYTES) return "Il file supera i 15 MB";
  const h = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const starts = (...sig: number[]) => sig.every((b, i) => h[i] === b);
  const ok =
    (ext === "pdf" && starts(0x25, 0x50, 0x44, 0x46)) ||
    ((ext === "jpg" || ext === "jpeg") && starts(0xff, 0xd8, 0xff)) ||
    (ext === "png" && starts(0x89, 0x50, 0x4e, 0x47)) ||
    (ext === "docx" && starts(0x50, 0x4b, 0x03, 0x04)) ||
    (ext === "doc" && starts(0xd0, 0xcf, 0x11, 0xe0));
  return ok ? null : "Il contenuto del file non corrisponde alla sua estensione";
}

async function fileKey(dek: Uint8Array<ArrayBuffer>, aid: string) {
  return hkdf(dek, `sv:v1:attachment-key:${aid}`);
}

export async function* encryptFileChunks(dek: Uint8Array<ArrayBuffer>, aid: string, file: File) {
  const key = await fileKey(dek, aid);
  const count = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  for (let n = 0; n < count; n++) {
    const pt = new Uint8Array(await file.slice(n * CHUNK_SIZE, (n + 1) * CHUNK_SIZE).arrayBuffer());
    yield { n, count, data: await seal(key, pt, aad.chunk(aid, n)) };
  }
  wipe(key);
}

export async function decryptChunk(dek: Uint8Array<ArrayBuffer>, aid: string, n: number, data: Uint8Array<ArrayBuffer>) {
  const key = await fileKey(dek, aid);
  try {
    return await open(key, data, aad.chunk(aid, n));
  } finally {
    wipe(key);
  }
}

// ---------- Recipient keys ----------

/** drand quicknet: chain info is pinned so encryption needs no network access. */
const offlineQuicknet = {
  chain: () => ({ info: async () => defaultChainInfo, baseUrl: "" }),
  options: { disableBeaconVerification: false, noCache: false },
} as unknown as ChainClient;

export async function timelockSeal(text: string, at: Date) {
  const round = roundAt(at.getTime(), defaultChainInfo);
  return timelockEncrypt(round, Buffer.from(text, "utf8"), offlineQuicknet);
}

export function keyModeFor(trigger: Trigger, senderShares: boolean): KeyMode {
  if (senderShares) return "SENDER_SHARES_CODE";
  // Timelock only when the release moment is a known date that cannot come earlier.
  if (trigger.kind === "FIXED_DATE" && trigger.fireAt) return "ESCROW_TLOCK";
  return "ESCROW_SERVER";
}

export async function buildDelivery(
  dek: Uint8Array<ArrayBuffer>,
  mid: string,
  trigger: Trigger,
  r: { contactId: string; name: string; email: string; phone?: string; senderShares: boolean; codeHint?: string },
): Promise<{ input: DeliveryInput; code: string }> {
  const code = generateAccessCode();
  const salt = randomBytes(16);
  const codeKey = await deriveKey(normalizeCode(code), salt, CODE_KDF);
  const wrappedDek = toB64(await seal(codeKey, dek, aad.recipientDek(mid)));
  wipe(codeKey);
  const keyMode = keyModeFor(trigger, r.senderShares);
  const input: DeliveryInput = {
    contactId: r.contactId,
    name: r.name,
    email: r.email,
    phone: r.phone || undefined,
    keyMode,
    wrappedDek,
    codeSalt: toB64(salt),
  };
  if (keyMode === "ESCROW_TLOCK") input.escrow = await timelockSeal(code, new Date(trigger.fireAt!));
  else if (keyMode === "ESCROW_SERVER") input.escrow = code;
  else input.codeHint = r.codeHint?.slice(0, 300);
  return { input, code };
}

export async function unwrapRecipientDek(code: string, codeSalt: string, wrappedDek: string, mid: string) {
  const key = await deriveKey(normalizeCode(code), fromB64(codeSalt), CODE_KDF);
  try {
    return await open(key, fromB64(wrappedDek), aad.recipientDek(mid));
  } finally {
    wipe(key);
  }
}
