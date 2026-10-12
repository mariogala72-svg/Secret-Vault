import { timingSafeEqual } from "node:crypto";
import { runMaintenance } from "@/lib/server/engine";
import { HttpError, ok, route } from "@/lib/server/http";

export const maxDuration = 60;

/** Called by Vercel Cron (daily) and optionally by an external scheduler for minute-level precision. */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(401, "Unauthorized");
  return ok(await runMaintenance());
});
