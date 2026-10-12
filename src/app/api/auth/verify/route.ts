import { NextResponse } from "next/server";
import { audit } from "@/lib/server/audit";
import { consumeToken } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { appUrl } from "@/lib/server/http";

/** Link in the verification email. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const uid = token.length > 20 ? await consumeToken(token, "VERIFY_EMAIL") : null;
  if (!uid) return NextResponse.redirect(`${appUrl(req)}/verify-email?error=1`);
  await sql()`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${uid}`;
  await audit(uid, "EMAIL_VERIFIED");
  return NextResponse.redirect(`${appUrl(req)}/verify-email?verified=1`);
}
