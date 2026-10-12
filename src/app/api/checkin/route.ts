import { z } from "zod";
import { cancelOpenCase } from "@/lib/server/engine";
import { HttpError, ok, route } from "@/lib/server/http";
import { verifyToken } from "@/lib/server/seal";

/** One-click "I'm fine" from the reminder email: checks in and stops any verification in progress. */
export const POST = route(async (req) => {
  const { token } = z.object({ token: z.string().max(2000) }).parse(await req.json());
  const data = verifyToken<{ uid: string; p: string }>(token);
  if (!data || data.p !== "checkin") throw new HttpError(400, "Link non valido o scaduto");
  await cancelOpenCase(data.uid, "EMAIL_LINK");
  return ok();
});
