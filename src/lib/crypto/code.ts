import { randomBytes } from "./encoding";

// Crockford base32 (no I, L, O, U): easy to read aloud and type.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 20 chars = 100 bits, formatted as XXXX-XXXX-XXXX-XXXX-XXXX. */
export function generateAccessCode(): string {
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i++) out += ALPHABET[bytes[i] & 31];
  return out.match(/.{4}/g)!.join("-");
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function isWellFormedCode(input: string) {
  const n = normalizeCode(input);
  return n.length === 20 && [...n].every((c) => ALPHABET.includes(c));
}
