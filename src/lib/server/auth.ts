import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";
import { cookies } from "next/headers";
import { sql } from "./db";
import { HttpError } from "./http";
import { sha256 } from "./seal";

export type AuthedUser = {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  reauthAt: Date | null;
  sessionHash: string;
};

export const SESSION_COOKIE = "sv_session";
const SESSION_DAYS = 14;
const IDLE_HOURS = 48;

// The pepper lives outside the database: a stolen DB dump alone cannot be brute-forced.
function pepper(pw: string) {
  const key = process.env.SERVER_ENC_KEY;
  if (!key) throw new Error("SERVER_ENC_KEY non configurata");
  return createHmac("sha256", Buffer.from(key, "base64")).update(`sv:pw:${pw}`).digest("hex");
}

export async function hashPassword(pw: string) {
  return argon2id({ password: pepper(pw), salt: randomBytes(16), parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: "encoded" });
}

export async function verifyPassword(pw: string, hash: string) {
  try {
    return await argon2Verify({ password: pepper(pw), hash });
  } catch {
    return false;
  }
}

// Used when the account does not exist, so response times don't reveal it.
let dummyHash: Promise<string> | undefined;
export async function verifyDummy(pw: string) {
  await verifyPassword(pw, await (dummyHash ??= hashPassword("sv-dummy-password")));
  return false;
}

export async function createSession(userId: string, req: Request) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await sql()`
    insert into sessions (token_hash, user_id, expires_at, reauth_at, user_agent)
    values (${sha256(token)}, ${userId}, ${expires}, now(), ${(req.headers.get("user-agent") ?? "").slice(0, 200)})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(req: Request) {
  const token = readToken(req);
  if (token) await sql()`delete from sessions where token_hash = ${sha256(token)}`;
  (await cookies()).delete(SESSION_COOKIE);
}

function readToken(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function currentUser(req: Request): Promise<AuthedUser | null> {
  const token = readToken(req);
  if (!token) return null;
  const hash = sha256(token);
  const [row] = await sql()`
    select s.reauth_at, s.last_seen_at, u.id, u.email, u.display_name, u.email_verified_at
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash} and s.expires_at > now() and s.last_seen_at > now() - make_interval(hours => ${IDLE_HOURS})`;
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
    await sql()`update sessions set last_seen_at = now() where token_hash = ${hash}`;
  }
  return {
    uid: row.id,
    email: row.email,
    name: row.display_name,
    emailVerified: !!row.email_verified_at,
    reauthAt: row.reauth_at,
    sessionHash: hash,
  };
}

export async function requireUser(req: Request, opts: { verified?: boolean } = { verified: true }): Promise<AuthedUser> {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, "Accesso richiesto");
  if (opts.verified !== false && !user.emailVerified) throw new HttpError(403, "Verifica prima la tua email", "EMAIL_NOT_VERIFIED");
  return user;
}

/** Sensitive actions require re-entering the password in the last 5 minutes. */
export function requireRecentLogin(user: AuthedUser) {
  if (!user.reauthAt || Date.now() - new Date(user.reauthAt).getTime() > 5 * 60_000) {
    throw new HttpError(403, "Per sicurezza conferma la tua password", "REAUTH_REQUIRED");
  }
}

export async function issueToken(userId: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD", ttlMinutes: number) {
  const token = randomBytes(32).toString("base64url");
  await sql()`delete from auth_tokens where user_id = ${userId} and purpose = ${purpose}`;
  await sql()`
    insert into auth_tokens (token_hash, user_id, purpose, expires_at)
    values (${sha256(token)}, ${userId}, ${purpose}, now() + make_interval(mins => ${ttlMinutes}))`;
  return token;
}

/** Consumes a single-use token; returns the user id or null. */
export async function consumeToken(token: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD"): Promise<string | null> {
  const [row] = await sql()`
    update auth_tokens set used_at = now()
    where token_hash = ${sha256(token)} and purpose = ${purpose} and used_at is null and expires_at > now()
    returning user_id`;
  return row?.user_id ?? null;
}
