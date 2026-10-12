import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { emailIndex, sha256 } from "@/lib/server/seal";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { token } = z.object({ token: z.string().min(20).max(100) }).parse(await req.json());
  const s = await db().collection("deliveries").where("linkTokenHash", "==", sha256(token)).limit(1).get();
  const d = s.docs[0];
  if (!d || !["SENT", "OPENED"].includes(d.get("status"))) throw new HttpError(404, "Link non valido o scaduto");
  if (d.get("emailIdx") !== emailIndex(user.email)) {
    throw new HttpError(403, `Questo messaggio è indirizzato a ${d.get("emailMasked")}. Accedi con quell'indirizzo email.`, "WRONG_ACCOUNT");
  }
  if (!d.get("redeemedBy")) await d.ref.update({ redeemedBy: user.uid });
  return ok({ deliveryId: d.id });
});
