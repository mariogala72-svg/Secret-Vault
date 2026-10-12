import { argon2id } from "hash-wasm";
import { concat, fromB64, randomBytes, te, toB64 } from "./encoding";

/**
 * Envelope v1: | ver=1 (1) | nonce (12) | AES-256-GCM ciphertext+tag |
 * The associated data binds a ciphertext to its record/field so it cannot be swapped.
 */
const VERSION = 1;

export type KdfParams = { alg: "argon2id"; m: number; t: number; p: number };
export const VAULT_KDF: KdfParams = { alg: "argon2id", m: 65536, t: 3, p: 1 };
// Access codes carry 100 bits of entropy, so a lighter KDF is enough.
export const CODE_KDF: KdfParams = { alg: "argon2id", m: 19456, t: 2, p: 1 };

export async function deriveKey(secret: string | Uint8Array, salt: Uint8Array, params: KdfParams): Promise<Uint8Array<ArrayBuffer>> {
  const out = await argon2id({
    password: secret,
    salt,
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: 32,
    outputType: "binary",
  });
  return new Uint8Array(out);
}

export async function hkdf(ikm: Uint8Array<ArrayBuffer>, info: string, length = 32): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: te.encode(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function aesKey(raw: Uint8Array<ArrayBuffer>, usage: KeyUsage[]) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, usage);
}

export async function seal(key: Uint8Array<ArrayBuffer>, plaintext: Uint8Array<ArrayBuffer>, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  const nonce = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: te.encode(aad) },
    await aesKey(key, ["encrypt"]),
    plaintext,
  );
  return concat(new Uint8Array([VERSION]), nonce, new Uint8Array(ct));
}

export async function open(key: Uint8Array<ArrayBuffer>, envelope: Uint8Array<ArrayBuffer>, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  if (envelope[0] !== VERSION) throw new Error("Unsupported envelope version");
  const nonce = envelope.subarray(1, 13);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, additionalData: te.encode(aad) },
    await aesKey(key, ["decrypt"]),
    envelope.subarray(13),
  );
  return new Uint8Array(pt);
}

export const sealB64 = async (key: Uint8Array<ArrayBuffer>, pt: Uint8Array<ArrayBuffer>, aad: string) => toB64(await seal(key, pt, aad));
export const openB64 = (key: Uint8Array<ArrayBuffer>, b64: string, aad: string) => open(key, fromB64(b64), aad);

// ---------- Asymmetric: ECIES over P-256 (ECDH + HKDF + AES-GCM) ----------

const EC = { name: "ECDH", namedCurve: "P-256" } as const;

export async function generateKeyPair() {
  const kp = (await crypto.subtle.generateKey(EC, true, ["deriveBits"])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
  const privateKey = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  return { publicKey, privateKey };
}

async function ecdh(priv: CryptoKey, pub: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256));
}

/** Seals data to a public key (SPKI). Output: | spkiLen (2) | ephemeral spki | envelope | */
export async function sealToPublicKey(publicKeySpki: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>, aad: string) {
  const recipient = await crypto.subtle.importKey("spki", publicKeySpki, EC, false, []);
  const eph = (await crypto.subtle.generateKey(EC, true, ["deriveBits"])) as CryptoKeyPair;
  const ephSpki = new Uint8Array(await crypto.subtle.exportKey("spki", eph.publicKey));
  const key = await hkdf(await ecdh(eph.privateKey, recipient), "sv:v1:ecies");
  const env = await seal(key, data, aad);
  return concat(new Uint8Array([ephSpki.length >> 8, ephSpki.length & 0xff]), ephSpki, env);
}

export async function openWithPrivateKey(privateKeyPkcs8: Uint8Array<ArrayBuffer>, sealed: Uint8Array<ArrayBuffer>, aad: string) {
  const len = (sealed[0] << 8) | sealed[1];
  const ephSpki = sealed.slice(2, 2 + len);
  const env = sealed.slice(2 + len);
  const priv = await crypto.subtle.importKey("pkcs8", privateKeyPkcs8, EC, false, ["deriveBits"]);
  const eph = await crypto.subtle.importKey("spki", ephSpki, EC, false, []);
  const key = await hkdf(await ecdh(priv, eph), "sv:v1:ecies");
  return open(key, env, aad);
}

export async function sha256Hex(data: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}
