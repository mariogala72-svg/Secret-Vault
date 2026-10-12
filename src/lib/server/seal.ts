import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Server-side protection for data the server must be able to use (recipient addresses, escrowed codes).
 * Content written in the vault never reaches this layer in clear: it is encrypted in the browser.
 */
function masterKey(): Buffer {
  const raw = process.env.SERVER_ENC_KEY;
  if (!raw) throw new Error("SERVER_ENC_KEY non configurata");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SERVER_ENC_KEY deve essere di 32 byte in base64");
  return key;
}

const derived = new Map<string, Buffer>();
function subKey(purpose: string): Buffer {
  let k = derived.get(purpose);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", masterKey(), Buffer.alloc(32), `sv:server:${purpose}`, 32));
    derived.set(purpose, k);
  }
  return k;
}

export function sealStr(plain: string, purpose = "pii"): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", subKey(`seal:${purpose}`), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), ct]).toString("base64");
}

export function openStr(sealed: string | undefined | null, purpose = "pii"): string {
  if (!sealed) return "";
  const b = Buffer.from(sealed, "base64");
  if (b[0] !== 1) throw new Error("Unsupported sealed version");
  const d = createDecipheriv("aes-256-gcm", subKey(`seal:${purpose}`), b.subarray(1, 13));
  d.setAuthTag(b.subarray(13, 29));
  return Buffer.concat([d.update(b.subarray(29)), d.final()]).toString("utf8");
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Deterministic HMAC so we can look up "deliveries for this email" without storing it in clear. */
export function blindIndex(value: string): string {
  return createHmac("sha256", subKey("bidx")).update(value).digest("base64url");
}
export const emailIndex = (email: string) => blindIndex(`email:${normalizeEmail(email)}`);

export const randomToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("base64url");

/** Signed, expiring token for links in emails (e.g. check-in). */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const sig = createHmac("sha256", subKey("token")).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", subKey("token")).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
  return data.exp > Date.now() / 1000 ? data : null;
}

export function maskEmail(email: string) {
  const [u, d = ""] = email.split("@");
  const [dn, ...tld] = d.split(".");
  return `${u.slice(0, 1)}•••@${dn.slice(0, 1)}•••.${tld.join(".")}`;
}
