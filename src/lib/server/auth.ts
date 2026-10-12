import "server-only";
import { adminAuth } from "./firebase";
import { HttpError } from "./http";

export type AuthedUser = { uid: string; email: string; emailVerified: boolean; authTime: number; name?: string };

export async function requireUser(req: Request, opts: { verified?: boolean } = { verified: true }): Promise<AuthedUser> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) throw new HttpError(401, "Accesso richiesto");
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch {
    throw new HttpError(401, "Sessione scaduta, accedi di nuovo");
  }
  const user: AuthedUser = {
    uid: decoded.uid,
    email: (decoded.email ?? "").toLowerCase(),
    emailVerified: !!decoded.email_verified,
    authTime: decoded.auth_time,
    name: decoded.name,
  };
  if (opts.verified !== false && !user.emailVerified) throw new HttpError(403, "Verifica prima la tua email", "EMAIL_NOT_VERIFIED");
  return user;
}

/** Sensitive actions require a fresh sign-in (re-authentication in the last 5 minutes). */
export function requireRecentLogin(user: AuthedUser) {
  if (Date.now() / 1000 - user.authTime > 300) throw new HttpError(403, "Per sicurezza conferma la tua password", "REAUTH_REQUIRED");
}
