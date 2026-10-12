import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist as italian } from "@scure/bip39/wordlists/italian";
import { fromB64, randomBytes, toB64, wipe } from "./encoding";
import { deriveKey, generateKeyPair, hkdf, KdfParams, open, seal, VAULT_KDF } from "./primitives";

export type VaultRecord = {
  kdfSalt: string;
  kdfParams: KdfParams;
  publicKey: string;
  encPrivateKeyPwd: string;
  encPrivateKeyRecovery: string;
};

export type UnlockedVault = { publicKey: Uint8Array<ArrayBuffer>; privateKey: Uint8Array<ArrayBuffer> };

const aad = (uid: string, slot: string) => `sv:v1:vault:${uid}:${slot}`;

async function recoveryKek(words: string) {
  const entropy = mnemonicToEntropy(words.trim().toLowerCase().replace(/\s+/g, " "), italian);
  const kek = await hkdf(new Uint8Array(entropy), "sv:v1:recovery-kek");
  wipe(entropy);
  return kek;
}

export function isValidRecoveryPhrase(words: string) {
  return validateMnemonic(words.trim().toLowerCase().replace(/\s+/g, " "), italian);
}

export async function createVault(uid: string, password: string) {
  const salt = randomBytes(16);
  const kek = await deriveKey(password, salt, VAULT_KDF);
  const entropy = randomBytes(32);
  const recoveryWords = entropyToMnemonic(entropy, italian);
  const kekRec = await hkdf(entropy, "sv:v1:recovery-kek");
  const { publicKey, privateKey } = await generateKeyPair();

  const record: VaultRecord = {
    kdfSalt: toB64(salt),
    kdfParams: VAULT_KDF,
    publicKey: toB64(publicKey),
    encPrivateKeyPwd: toB64(await seal(kek, privateKey, aad(uid, "pwd"))),
    encPrivateKeyRecovery: toB64(await seal(kekRec, privateKey, aad(uid, "rec"))),
  };
  wipe(kek, kekRec, entropy);
  return { record, recoveryWords, unlocked: { publicKey, privateKey } as UnlockedVault };
}

export async function unlockWithPassword(uid: string, v: Pick<VaultRecord, "kdfSalt" | "kdfParams" | "publicKey" | "encPrivateKeyPwd">, password: string): Promise<UnlockedVault> {
  const kek = await deriveKey(password, fromB64(v.kdfSalt), v.kdfParams);
  try {
    const privateKey = await open(kek, fromB64(v.encPrivateKeyPwd), aad(uid, "pwd"));
    return { publicKey: fromB64(v.publicKey), privateKey };
  } finally {
    wipe(kek);
  }
}

export async function unlockWithRecovery(uid: string, v: Pick<VaultRecord, "publicKey" | "encPrivateKeyRecovery">, words: string): Promise<UnlockedVault> {
  const kek = await recoveryKek(words);
  try {
    const privateKey = await open(kek, fromB64(v.encPrivateKeyRecovery), aad(uid, "rec"));
    return { publicKey: fromB64(v.publicKey), privateKey };
  } finally {
    wipe(kek);
  }
}

/** Re-encrypts the private key under a new password (messages are untouched). */
export async function rewrapForPassword(uid: string, unlocked: UnlockedVault, newPassword: string) {
  const salt = randomBytes(16);
  const kek = await deriveKey(newPassword, salt, VAULT_KDF);
  const out = {
    kdfSalt: toB64(salt),
    kdfParams: VAULT_KDF,
    encPrivateKeyPwd: toB64(await seal(kek, unlocked.privateKey, aad(uid, "pwd"))),
  };
  wipe(kek);
  return out;
}
