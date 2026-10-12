import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

const b64 = z.string().max(20_000).regex(/^[A-Za-z0-9+/=]+$/);
const Kdf = z.object({ alg: z.literal("argon2id"), m: z.number().int().min(19456).max(1048576), t: z.number().int().min(2).max(10), p: z.number().int().min(1).max(4) });

/** Returns the encrypted key material. The vault password never reaches the server. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const [v] = await sql()`select * from vaults where user_id = ${user.uid}`;
  if (!v) return ok({ exists: false });
  if (v.locked_until && new Date(v.locked_until).getTime() > Date.now()) {
    const t = new Date(v.locked_until).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
    throw new HttpError(429, `Troppi tentativi. Riprova dopo le ${t}`, "VAULT_LOCKED");
  }
  const recovery = new URL(req.url).searchParams.get("recovery") === "1";
  return ok({
    exists: true,
    kdfSalt: v.kdf_salt,
    kdfParams: v.kdf_params,
    publicKey: v.public_key,
    ...(recovery ? { encPrivateKeyRecovery: v.enc_private_key_recovery } : { encPrivateKeyPwd: v.enc_private_key_pwd }),
  });
});

const Create = z.object({ kdfSalt: b64, kdfParams: Kdf, publicKey: b64, encPrivateKeyPwd: b64, encPrivateKeyRecovery: b64 });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const b = Create.parse(await req.json());
  const [v] = await sql()`
    insert into vaults (user_id, kdf_salt, kdf_params, public_key, enc_private_key_pwd, enc_private_key_recovery)
    values (${user.uid}, ${b.kdfSalt}, ${sql().json(b.kdfParams)}, ${b.publicKey}, ${b.encPrivateKeyPwd}, ${b.encPrivateKeyRecovery})
    on conflict (user_id) do nothing returning user_id`;
  if (!v) throw new HttpError(409, "La cassaforte esiste già");
  await audit(user.uid, "VAULT_CREATED");
  return ok({}, 201);
});

const Rewrap = z.object({ kdfSalt: b64, kdfParams: Kdf, encPrivateKeyPwd: b64 });

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const b = Rewrap.parse(await req.json());
  await sql()`
    update vaults set kdf_salt = ${b.kdfSalt}, kdf_params = ${sql().json(b.kdfParams)}, enc_private_key_pwd = ${b.encPrivateKeyPwd},
      failed_unlocks = 0, locked_until = null, updated_at = now()
    where user_id = ${user.uid}`;
  await audit(user.uid, "VAULT_PASSWORD_CHANGED");
  return ok();
});
