import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";

const b64 = z.string().max(20_000).regex(/^[A-Za-z0-9+/=]+$/);
const Kdf = z.object({ alg: z.literal("argon2id"), m: z.number().int().min(19456).max(1048576), t: z.number().int().min(2).max(10), p: z.number().int().min(1).max(4) });

/** Returns the encrypted key material. The vault password never reaches the server. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const snap = await db().collection("vaults").doc(user.uid).get();
  if (!snap.exists) return ok({ exists: false });
  const lockedUntil = snap.get("lockedUntil")?.toMillis?.() ?? 0;
  if (lockedUntil > Date.now()) throw new HttpError(429, `Troppi tentativi. Riprova dopo le ${new Date(lockedUntil).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" })}`, "VAULT_LOCKED");
  const recovery = new URL(req.url).searchParams.get("recovery") === "1";
  return ok({
    exists: true,
    kdfSalt: snap.get("kdfSalt"),
    kdfParams: snap.get("kdfParams"),
    publicKey: snap.get("publicKey"),
    ...(recovery ? { encPrivateKeyRecovery: snap.get("encPrivateKeyRecovery") } : { encPrivateKeyPwd: snap.get("encPrivateKeyPwd") }),
  });
});

const Create = z.object({ kdfSalt: b64, kdfParams: Kdf, publicKey: b64, encPrivateKeyPwd: b64, encPrivateKeyRecovery: b64 });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = Create.parse(await req.json());
  const ref = db().collection("vaults").doc(user.uid);
  await db().runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw new HttpError(409, "La cassaforte esiste già");
    tx.set(ref, { ...body, failedUnlocks: 0, createdAt: FieldValue.serverTimestamp() });
  });
  await audit(user.uid, "VAULT_CREATED");
  return ok({}, 201);
});

const Rewrap = z.object({ kdfSalt: b64, kdfParams: Kdf, encPrivateKeyPwd: b64 });

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = Rewrap.parse(await req.json());
  await db().collection("vaults").doc(user.uid).update({ ...body, failedUnlocks: 0, lockedUntil: null, updatedAt: FieldValue.serverTimestamp() });
  await audit(user.uid, "VAULT_PASSWORD_CHANGED");
  return ok();
});
